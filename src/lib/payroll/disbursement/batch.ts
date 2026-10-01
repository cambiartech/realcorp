import {
  HrPayslipPaymentStatus,
  HrPayslipRunStatus,
  PayrollDisbursementBatchStatus,
  PayrollDisbursementLineStatus,
  PayrollLedgerEntryType,
  type Prisma,
} from "@/generated/prisma";
import prisma from "@/lib/db";
import { parseSalaryBankAccount, salaryBankAccountToJson } from "./bank-account";
import { completeSalaryBank } from "./bank-match";
import {
  getAvailableBalanceKobo,
  PayrollLedgerError,
  postLedgerEntry,
  type LedgerTx,
} from "./ledger";
import {
  calculatePayoutFeeKobo,
  decimalLikeToKobo,
  koboToNairaString,
  parseFeeSchedule,
} from "./money";
import {
  isPaystackConfigured,
  paystackCreateRecipient,
  paystackFinalizeTransfer,
  paystackGetNgnBalanceKobo,
  paystackInitiateBulkTransfer,
  paystackListBanks,
  paystackResendTransferOtp,
  paystackResolveAccount,
} from "./paystack";
import { estimatePaystackTransferFeeKobo } from "./provider-fees";
import { parsePayrollDisbursementSettings } from "./settings";

export type DisburseActor = {
  userId: string;
  label: string;
};

/** Paystack NGN minimum single transfer (docs: support article Transfers). */
const PAYSTACK_MIN_TRANSFER_KOBO = 5_000; // ₦50

/** Shown on a line Paystack will not send until the business phone confirms the SMS code. */
export const PAYSTACK_OTP_HOLD =
  "Paystack sent a verification code to the business phone. A Realcorp admin confirms it before money moves.";

function explainPaystackTransferError(raw: string): string {
  const msg = raw.trim();
  if (/balance is not enough/i.test(msg)) {
    return (
      `${msg} — Paystack Transfers debit your merchant Paystack balance (Dashboard → Balance), ` +
      `not the org Available float. Top up that balance (or wait for DVA deposits to settle there), then retry.`
    );
  }
  if (/otp/i.test(msg)) {
    return (
      "Paystack will not send a whole payroll while confirmation codes are turned on. " +
      "In Paystack → Settings → Preferences, turn off “Confirm transfers before sending”, then click Pay again. " +
      "One payroll is one batch — not a code per person."
    );
  }
  return msg;
}

/**
 * Transfers API source is always `balance` (merchant Paystack balance).
 * Org Available float is our ledger only — it does not pull from a customer's DVA.
 */
async function assertPaystackBalanceForBatch(batch: {
  totalNet: Prisma.Decimal | string;
  totalProviderFeeEstimate: Prisma.Decimal | string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const needKobo =
    decimalLikeToKobo(batch.totalNet) + decimalLikeToKobo(batch.totalProviderFeeEstimate);

  const balances = await paystackGetNgnBalanceKobo();
  if (!balances.ok) {
    return {
      ok: false,
      error: `Could not read Paystack balance before sending: ${balances.error}`,
    };
  }
  if (balances.balanceKobo < needKobo) {
    return {
      ok: false,
      error:
        `Paystack balance is ₦${koboToNairaString(balances.balanceKobo)}; this payout needs about ₦${koboToNairaString(needKobo)} ` +
        `(net + Paystack transfer fees). Org Available float is separate — confirm DVA deposits settled to Paystack Balance ` +
        `(Settled to Balance), then try again.`,
    };
  }
  return { ok: true };
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export type SalaryPayPreviewRow = {
  employeeName: string;
  netPay: string;
  bankName: string;
  accountNumber: string;
  ready: boolean;
  reason?: string;
};

export type SalaryPayPreview = {
  ok: true;
  rows: SalaryPayPreviewRow[];
  readyCount: number;
  totalNetLabel: string;
  estimatedProviderFeeLabel: string;
  needLabel: string;
  orgAvailableLabel: string;
  floatOk: boolean;
  /** Merchant Paystack Balance can cover net + transfer fees (not exposed as raw ₦ to orgs). */
  paystackRailOk: boolean;
  canSend: boolean;
};

/** Resolve bank codes onto People records and return who would be paid. Does not move money. */
export async function previewSalaryDisbursement(
  tenantId: string,
  payslipRunId: string,
): Promise<SalaryPayPreview | { ok: false; error: string }> {
  const run = await prisma.hrPayslipRun.findFirst({
    where: { id: payslipRunId, tenantId },
    include: {
      payslips: {
        where: { paymentStatus: HrPayslipPaymentStatus.PENDING },
        include: {
          profile: { select: { id: true, fullName: true, bankAccount: true } },
        },
      },
    },
  });
  if (!run) return { ok: false, error: "Payslip run not found." };
  if (run.status !== HrPayslipRunStatus.FINALIZED) {
    return { ok: false, error: "Publish the payroll month before paying." };
  }

  const listed = await paystackListBanks();
  const banks = listed.ok ? listed.data : [];
  const rows: SalaryPayPreviewRow[] = [];
  let totalNetKobo = 0;
  let providerFeeKobo = 0;

  for (const slip of run.payslips) {
    const net = decimalLikeToKobo(slip.netPay);
    if (net <= 0) continue;
    let bank = parseSalaryBankAccount(slip.profile.bankAccount);
    if (bank.ok && !bank.disbursementReady) {
      const completed = completeSalaryBank(bank.account, banks, slip.profile.fullName || "");
      if (completed.ok) {
        if (completed.changed) {
          await prisma.employeeProfile.update({
            where: { id: slip.profile.id },
            data: { bankAccount: salaryBankAccountToJson(completed.account) },
          });
        }
        bank = { ok: true, account: completed.account, disbursementReady: true, warnings: [] };
      } else if (!bank.account.bankCode) {
        bank = { ok: false, error: completed.error };
      }
    }

    const ready = bank.ok && bank.disbursementReady;
    if (ready) {
      totalNetKobo += net;
      providerFeeKobo += estimatePaystackTransferFeeKobo(net);
    }
    rows.push({
      employeeName: slip.profile.fullName || "Employee",
      netPay: koboToNairaString(net),
      bankName: bank.ok ? bank.account.bankName : "",
      accountNumber: bank.ok ? bank.account.accountNumber : "",
      ready,
      reason: ready ? undefined : bank.ok ? bank.warnings.join(" ") : bank.error,
    });
  }

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { payrollDisbursementSettings: true },
  });
  const feeSchedule = parseFeeSchedule(parsePayrollDisbursementSettings(settings?.payrollDisbursementSettings));
  let platformFeeKobo = 0;
  for (const row of rows) {
    if (!row.ready) continue;
    platformFeeKobo += calculatePayoutFeeKobo(decimalLikeToKobo(row.netPay), feeSchedule);
  }

  const orgAvailableKobo = await getAvailableBalanceKobo(prisma, tenantId);
  const floatNeedKobo = totalNetKobo + platformFeeKobo;
  const paystackNeedKobo = totalNetKobo + providerFeeKobo;
  const floatOk = orgAvailableKobo >= floatNeedKobo && totalNetKobo > 0;

  let paystackRailOk = false;
  if (isPaystackConfigured() && paystackNeedKobo > 0) {
    const rail = await paystackGetNgnBalanceKobo();
    paystackRailOk = rail.ok && rail.balanceKobo >= paystackNeedKobo;
  }

  const readyCount = rows.filter((row) => row.ready).length;
  return {
    ok: true,
    rows,
    readyCount,
    totalNetLabel: koboToNairaString(totalNetKobo),
    estimatedProviderFeeLabel: koboToNairaString(providerFeeKobo),
    needLabel: koboToNairaString(floatNeedKobo),
    orgAvailableLabel: koboToNairaString(orgAvailableKobo),
    floatOk,
    paystackRailOk,
    canSend: readyCount > 0 && floatOk && paystackRailOk,
  };
}

/**
 * Build a DRAFT disbursement batch from a FINALIZED payslip run.
 * Does not move money — only validates bank data and totals.
 */
export async function createDisbursementBatchFromRun(
  tenantId: string,
  payslipRunId: string,
  actor: DisburseActor,
): Promise<{ ok: true; batchId: string; created: boolean } | { ok: false; error: string }> {
  if (!isPaystackConfigured()) {
    return {
      ok: false,
      error: "Paystack is not configured. Set PAYSTACK_SECRET_KEY in the server environment.",
    };
  }

  const run = await prisma.hrPayslipRun.findFirst({
    where: { id: payslipRunId, tenantId },
    include: {
      payslips: {
        where: { paymentStatus: HrPayslipPaymentStatus.PENDING },
        include: {
          profile: {
            select: {
              id: true,
              fullName: true,
              bankAccount: true,
            },
          },
        },
      },
    },
  });
  if (!run) return { ok: false, error: "Payslip run not found." };
  if (run.status !== HrPayslipRunStatus.FINALIZED) {
    return { ok: false, error: "Publish (finalize) the payroll month before disbursing." };
  }
  if (run.payslips.length === 0) {
    return { ok: false, error: "No unpaid payslips in this run." };
  }

  const existingBatches = await prisma.payrollDisbursementBatch.findMany({
    where: { tenantId, payslipRunId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { lines: { select: { payslipId: true, status: true } } },
  });

  const alreadyPaidSlipIds = new Set(
    existingBatches.flatMap((batch) =>
      batch.lines
        .filter((line) => line.status === PayrollDisbursementLineStatus.SUCCESS)
        .map((line) => line.payslipId),
    ),
  );

  for (const existing of existingBatches) {
    if (
      existing.status === PayrollDisbursementBatchStatus.DRAFT ||
      existing.status === PayrollDisbursementBatchStatus.SENDING
    ) {
      return { ok: true, batchId: existing.id, created: false };
    }
  }

  const slipsToPay = run.payslips.filter((slip) => !alreadyPaidSlipIds.has(slip.id));
  if (slipsToPay.length === 0) {
    return { ok: false, error: "Everyone for this month was already paid. You cannot pay the same slips twice." };
  }

  const attempt = existingBatches.length + 1;
  const idempotencyKey = `disburse:${run.id}:${monthKey(run.year, run.month)}:v${attempt}`;

  const colliding = await prisma.payrollDisbursementBatch.findUnique({
    where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
  });
  if (
    colliding &&
    (colliding.status === PayrollDisbursementBatchStatus.DRAFT ||
      colliding.status === PayrollDisbursementBatchStatus.SENDING)
  ) {
    return { ok: true, batchId: colliding.id, created: false };
  }

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { payrollDisbursementSettings: true },
  });
  const feeSchedule = parseFeeSchedule(parsePayrollDisbursementSettings(settings?.payrollDisbursementSettings));

  const lines: Array<{
    payslipId: string;
    employeeProfileId: string;
    amount: string;
    platformFee: string;
    providerFeeEstimate: string;
    accountNumber: string;
    bankCode: string;
    accountName: string;
    providerReference: string;
    status: PayrollDisbursementLineStatus;
    failureReason?: string;
  }> = [];

  let totalNetKobo = 0;
  let totalFeeKobo = 0;
  let totalProviderFeeKobo = 0;
  let skipped = 0;

  const needsBankList = slipsToPay.some((slip) => {
    const parsed = parseSalaryBankAccount(slip.profile.bankAccount);
    return parsed.ok && !parsed.disbursementReady && parsed.account.bankName;
  });
  const bankList = needsBankList ? await paystackListBanks() : { ok: true as const, data: [] };
  const banks = bankList.ok ? bankList.data : [];

  for (const slip of slipsToPay) {
    const net = decimalLikeToKobo(slip.netPay);
    if (net <= 0) {
      skipped += 1;
      continue;
    }
    let bank = parseSalaryBankAccount(slip.profile.bankAccount);
    const ref = `rcpay_${run.id.slice(-8)}_${slip.id.slice(-10)}_${Date.now().toString(36)}`.slice(0, 50);

    if (bank.ok && !bank.disbursementReady) {
      const completed = completeSalaryBank(bank.account, banks, slip.profile.fullName || "");
      if (completed.ok) {
        if (completed.changed) {
          await prisma.employeeProfile.update({
            where: { id: slip.profile.id },
            data: { bankAccount: salaryBankAccountToJson(completed.account) },
          });
        }
        bank = {
          ok: true,
          account: completed.account,
          disbursementReady: true,
          warnings: [],
        };
      } else if (!bank.account.bankCode) {
        bank = { ok: false, error: completed.error };
      }
    }

    if (!bank.ok || !bank.disbursementReady) {
      lines.push({
        payslipId: slip.id,
        employeeProfileId: slip.employeeProfileId,
        amount: koboToNairaString(net),
        platformFee: "0.00",
        providerFeeEstimate: "0.00",
        accountNumber: bank.ok ? bank.account.accountNumber : "",
        bankCode: bank.ok ? bank.account.bankCode : "",
        accountName: bank.ok ? bank.account.accountHolderName : slip.profile.fullName || "Employee",
        providerReference: ref,
        status: PayrollDisbursementLineStatus.SKIPPED,
        failureReason: `${slip.profile.fullName || "Employee"}: ${
          bank.ok ? bank.warnings.join(" ") || "Bank details incomplete." : bank.error
        }`,
      });
      skipped += 1;
      continue;
    }

    const platformFeeKobo = calculatePayoutFeeKobo(net, feeSchedule);
    const providerFeeKobo = estimatePaystackTransferFeeKobo(net);
    totalNetKobo += net;
    totalFeeKobo += platformFeeKobo;
    totalProviderFeeKobo += providerFeeKobo;

    lines.push({
      payslipId: slip.id,
      employeeProfileId: slip.employeeProfileId,
      amount: koboToNairaString(net),
      platformFee: koboToNairaString(platformFeeKobo),
      providerFeeEstimate: koboToNairaString(providerFeeKobo),
      accountNumber: bank.account.accountNumber,
      bankCode: bank.account.bankCode,
      accountName: bank.account.accountHolderName || slip.profile.fullName || "Employee",
      providerReference: ref,
      status: PayrollDisbursementLineStatus.PENDING,
    });
  }

  const sendable = lines.filter((l) => l.status === PayrollDisbursementLineStatus.PENDING);
  if (sendable.length === 0) {
    const reason = lines.find((line) => line.failureReason)?.failureReason;
    return {
      ok: false,
      error: reason || "No unpaid salary has a complete bank account.",
    };
  }

  const batch = await prisma.payrollDisbursementBatch.create({
    data: {
      tenantId,
      payslipRunId: run.id,
      provider: "PAYSTACK",
      status: PayrollDisbursementBatchStatus.DRAFT,
      currency: "NGN",
      totalNet: koboToNairaString(totalNetKobo),
      totalPlatformFee: koboToNairaString(totalFeeKobo),
      totalProviderFeeEstimate: koboToNairaString(totalProviderFeeKobo),
      lineCount: lines.length,
      skippedCount: skipped,
      idempotencyKey,
      createdByUserId: actor.userId,
      createdByLabel: actor.label,
      lines: {
        create: lines.map((l) => ({
          tenantId,
          payslipId: l.payslipId,
          employeeProfileId: l.employeeProfileId,
          amount: l.amount,
          platformFee: l.platformFee,
          providerFeeEstimate: l.providerFeeEstimate,
          currency: "NGN",
          accountNumber: l.accountNumber || "0000000000",
          bankCode: l.bankCode || "000",
          accountName: l.accountName,
          providerReference: l.providerReference,
          status: l.status,
          failureReason: l.failureReason,
        })),
      },
    },
  });

  return { ok: true, batchId: batch.id, created: true };
}

async function reserveBatchFunds(tx: LedgerTx, batchId: string, actor: DisburseActor) {
  const batch = await tx.payrollDisbursementBatch.findUnique({
    where: { id: batchId },
  });
  if (!batch) throw new PayrollLedgerError("Batch not found.");
  if (batch.status !== PayrollDisbursementBatchStatus.DRAFT) {
    throw new PayrollLedgerError(`Batch is ${batch.status} — cannot start again.`);
  }

  const needKobo =
    decimalLikeToKobo(batch.totalNet) + decimalLikeToKobo(batch.totalPlatformFee);
  const available = await getAvailableBalanceKobo(tx, batch.tenantId);
  if (available < needKobo) {
    throw new PayrollLedgerError(
      `Insufficient Available balance. Need ₦${koboToNairaString(needKobo)}, have ₦${koboToNairaString(available)}. Fund and verify first.`,
    );
  }

  if (decimalLikeToKobo(batch.totalNet) > 0) {
    await postLedgerEntry(tx, {
      tenantId: batch.tenantId,
      entryType: PayrollLedgerEntryType.PAYOUT_DEBIT,
      amountNaira: batch.totalNet.toString(),
      currency: batch.currency,
      idempotencyKey: `payout:${batch.id}`,
      description: `Salary payout batch ${batch.id}`,
      disbursementBatchId: batch.id,
      createdByUserId: actor.userId,
      createdByLabel: actor.label,
    });
  }
  if (decimalLikeToKobo(batch.totalPlatformFee) > 0) {
    await postLedgerEntry(tx, {
      tenantId: batch.tenantId,
      entryType: PayrollLedgerEntryType.FEE_DEBIT,
      amountNaira: batch.totalPlatformFee.toString(),
      currency: batch.currency,
      idempotencyKey: `fee:${batch.id}`,
      description: `Platform payout fees for batch ${batch.id}`,
      disbursementBatchId: batch.id,
      createdByUserId: actor.userId,
      createdByLabel: actor.label,
    });
  }

  await tx.payrollDisbursementBatch.update({
    where: { id: batch.id },
    data: {
      status: PayrollDisbursementBatchStatus.SENDING,
      approvedAt: new Date(),
      approvedByUserId: actor.userId,
      approvedByLabel: actor.label,
      startedAt: new Date(),
    },
  });

  return batch;
}

/**
 * Reserve ledger funds then send each PENDING line via Paystack.
 * Call after createDisbursementBatchFromRun.
 */
export async function executeDisbursementBatch(
  tenantId: string,
  batchId: string,
  actor: DisburseActor,
): Promise<{ ok: true; success: number; failed: number } | { ok: false; error: string }> {
  if (!isPaystackConfigured()) {
    return { ok: false, error: "PAYSTACK_SECRET_KEY is not set." };
  }

  const batch = await prisma.payrollDisbursementBatch.findFirst({
    where: { id: batchId, tenantId },
  });
  if (!batch) return { ok: false, error: "Batch not found." };

  if (
    batch.status === PayrollDisbursementBatchStatus.FAILED ||
    batch.status === PayrollDisbursementBatchStatus.PARTIAL ||
    batch.status === PayrollDisbursementBatchStatus.COMPLETED ||
    batch.status === PayrollDisbursementBatchStatus.CANCELLED
  ) {
    return {
      ok: false,
      error:
        batch.status === PayrollDisbursementBatchStatus.COMPLETED
          ? "This pay attempt already finished."
          : "This pay attempt stopped. Click Pay again to start a new attempt for unpaid staff.",
    };
  }

  // Check merchant Paystack balance before debiting org float (Transfers use source: balance).
  if (batch.status === PayrollDisbursementBatchStatus.DRAFT) {
    const paystackReady = await assertPaystackBalanceForBatch(batch);
    if (!paystackReady.ok) return paystackReady;

    try {
      await prisma.$transaction(async (tx) => {
        await reserveBatchFunds(tx, batchId, actor);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not reserve funds.";
      return { ok: false, error: message };
    }
  }

  const lines = await prisma.payrollDisbursementLine.findMany({
    where: {
      batchId,
      tenantId,
      status: PayrollDisbursementLineStatus.PENDING,
    },
    orderBy: { createdAt: "asc" },
  });

  let success = 0;
  let failed = 0;
  const ready: Array<{
    line: (typeof lines)[number];
    amountKobo: number;
    recipientCode: string;
    accountName: string;
  }> = [];

  for (const line of lines) {
    await prisma.payrollDisbursementLine.update({
      where: { id: line.id },
      data: { status: PayrollDisbursementLineStatus.SENDING },
    });

    const amountKobo = decimalLikeToKobo(line.amount);
    if (amountKobo > 0 && amountKobo < PAYSTACK_MIN_TRANSFER_KOBO) {
      await markLineFailed(
        line.id,
        `Amount ₦${koboToNairaString(amountKobo)} is below Paystack’s ₦50 minimum transfer.`,
      );
      await reverseLineOnLedger(tenantId, line, actor);
      failed += 1;
      continue;
    }

    const resolve = await paystackResolveAccount(line.accountNumber, line.bankCode);
    if (!resolve.ok) {
      await markLineFailed(line.id, resolve.error);
      await reverseLineOnLedger(tenantId, line, actor);
      failed += 1;
      continue;
    }

    const recipient = await paystackCreateRecipient({
      name: resolve.data.account_name || line.accountName,
      accountNumber: line.accountNumber,
      bankCode: line.bankCode,
    });
    if (!recipient.ok) {
      await markLineFailed(line.id, recipient.error);
      await reverseLineOnLedger(tenantId, line, actor);
      failed += 1;
      continue;
    }

    ready.push({
      line,
      amountKobo,
      recipientCode: recipient.data.recipient_code,
      accountName: resolve.data.account_name || line.accountName,
    });
  }

  for (let offset = 0; offset < ready.length; offset += 100) {
    const chunk = ready.slice(offset, offset + 100);
    if (offset > 0) await new Promise((resolve) => setTimeout(resolve, 5000));
    const transfer = await paystackInitiateBulkTransfer({
      transfers: chunk.map((item) => ({
        amountKobo: item.amountKobo,
        recipientCode: item.recipientCode,
        reference: item.line.providerReference,
        reason: `Salary ${item.line.providerReference}`,
      })),
    });
    if (!transfer.ok) {
      const reason = explainPaystackTransferError(transfer.error);
      for (const item of chunk) {
        await markLineFailed(item.line.id, reason);
        await reverseLineOnLedger(tenantId, item.line, actor);
        failed += 1;
      }
      continue;
    }

    const byReference = new Map(
      (Array.isArray(transfer.data) ? transfer.data : []).map((item) => [item.reference || "", item]),
    );
    for (const item of chunk) {
      const sent = byReference.get(item.line.providerReference);
      const status = (sent?.status || "").toLowerCase();
      if (!sent) {
        await markLineFailed(item.line.id, "Paystack did not return this salary in the batch.");
        await reverseLineOnLedger(tenantId, item.line, actor);
        failed += 1;
        continue;
      }
      if (status === "success") {
        await prisma.payrollDisbursementLine.update({
          where: { id: item.line.id },
          data: {
            recipientCode: item.recipientCode,
            accountNameResolved: item.accountName,
            transferCode: sent.transfer_code || null,
            providerTransferId: sent.id != null ? String(sent.id) : null,
          },
        });
        await markLineSuccess(
          item.line,
          sent.transfer_code,
          sent.id != null ? String(sent.id) : "",
          actor.label,
        );
        success += 1;
        continue;
      }
      if (status === "failed" || status === "reversed") {
        await markLineFailed(item.line.id, sent.reason || `Paystack status: ${status}`);
        await reverseLineOnLedger(tenantId, item.line, actor);
        failed += 1;
        continue;
      }
      await prisma.payrollDisbursementLine.update({
        where: { id: item.line.id },
        data: {
          recipientCode: item.recipientCode,
          accountNameResolved: item.accountName,
          transferCode: sent.transfer_code || null,
          providerTransferId: sent.id != null ? String(sent.id) : null,
          status: PayrollDisbursementLineStatus.SENDING,
          failureReason: status === "otp" ? PAYSTACK_OTP_HOLD : null,
        },
      });
    }
  }

  await refreshBatchCounts(batchId);
  return { ok: true, success, failed };
}

async function markLineFailed(lineId: string, reason: string) {
  await prisma.payrollDisbursementLine.update({
    where: { id: lineId },
    data: {
      status: PayrollDisbursementLineStatus.FAILED,
      failureReason: reason.slice(0, 500),
    },
  });
}

async function markLineSuccess(
  line: { id: string; payslipId: string; batchId: string; providerReference: string; amount: Prisma.Decimal | string },
  transferCode: string | undefined,
  transferId: string,
  paidByLabel: string,
) {
  await prisma.$transaction(async (tx) => {
    await tx.payrollDisbursementLine.update({
      where: { id: line.id },
      data: {
        status: PayrollDisbursementLineStatus.SUCCESS,
        transferCode: transferCode || null,
        providerTransferId: transferId || null,
        paidAt: new Date(),
        failureReason: null,
      },
    });
    await tx.hrPayslip.update({
      where: { id: line.payslipId },
      data: {
        paymentStatus: HrPayslipPaymentStatus.PAID,
        paidAt: new Date(),
        paymentReference: line.providerReference,
        paidByLabel,
        disbursementChannel: "PAYSTACK",
        disbursementBatchId: line.batchId,
        disbursementStatus: "SETTLED",
      },
    });
  });
}

async function reverseLineOnLedger(
  tenantId: string,
  line: { id: string; amount: Prisma.Decimal | string; platformFee: Prisma.Decimal | string; batchId: string },
  actor: DisburseActor,
) {
  const net = decimalLikeToKobo(line.amount);
  const fee = decimalLikeToKobo(line.platformFee);
  await prisma.$transaction(async (tx) => {
    if (net > 0) {
      await postLedgerEntry(tx, {
        tenantId,
        entryType: PayrollLedgerEntryType.PAYOUT_REVERSAL,
        amountNaira: koboToNairaString(net),
        idempotencyKey: `payout-rev:${line.id}`,
        description: `Reversal for failed payout line ${line.id}`,
        disbursementBatchId: line.batchId,
        createdByUserId: actor.userId,
        createdByLabel: actor.label,
      });
    }
    if (fee > 0) {
      await postLedgerEntry(tx, {
        tenantId,
        entryType: PayrollLedgerEntryType.ADJUSTMENT_CREDIT,
        amountNaira: koboToNairaString(fee),
        idempotencyKey: `fee-rev:${line.id}`,
        description: `Fee reversal for failed payout line ${line.id}`,
        disbursementBatchId: line.batchId,
        createdByUserId: actor.userId,
        createdByLabel: actor.label,
      });
    }
    await tx.payrollDisbursementLine.update({
      where: { id: line.id },
      data: { status: PayrollDisbursementLineStatus.REVERSED },
    });
  });
}

/** Realcorp admin submits the SMS code Paystack sent to the business phone. */
export async function finalizeDisbursementLineOtp(
  lineId: string,
  otp: string,
  actor: DisburseActor,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const code = otp.replace(/\s+/g, "");
  if (!/^\d{4,8}$/.test(code)) {
    return { ok: false, error: "Enter the numeric code from the Paystack SMS." };
  }

  const line = await prisma.payrollDisbursementLine.findUnique({ where: { id: lineId } });
  if (!line?.transferCode) {
    return { ok: false, error: "This payout is not waiting on a Paystack code." };
  }
  if (line.status !== PayrollDisbursementLineStatus.SENDING) {
    return { ok: false, error: `This line is ${line.status}.` };
  }

  const finalized = await paystackFinalizeTransfer(line.transferCode, code);
  if (!finalized.ok) return { ok: false, error: finalized.error };

  const status = (finalized.data.status || "").toLowerCase();
  if (status === "success") {
    await markLineSuccess(
      line,
      finalized.data.transfer_code || line.transferCode,
      String(finalized.data.id || line.providerTransferId || ""),
      actor.label,
    );
    await refreshBatchCounts(line.batchId);
    return { ok: true, message: "Paystack accepted the code. This salary is paid." };
  }
  if (status === "pending" || status === "received" || status === "queued" || !status) {
    await prisma.payrollDisbursementLine.update({
      where: { id: line.id },
      data: { failureReason: null, status: PayrollDisbursementLineStatus.SENDING },
    });
    await refreshBatchCounts(line.batchId);
    return { ok: true, message: "Paystack queued the transfer. It will finish on the webhook." };
  }
  if (status === "otp") {
    return {
      ok: false,
      error: "That code was not accepted. It expires in 30 minutes — resend a new one if needed.",
    };
  }
  if (status === "failed" || status === "reversed" || status === "abandoned") {
    await markLineFailed(line.id, `Paystack ${status} after verification.`);
    await reverseLineOnLedger(line.tenantId, line, actor);
    await refreshBatchCounts(line.batchId);
    return { ok: false, error: `Paystack marked this ${status}. Float for this line was reversed.` };
  }
  await refreshBatchCounts(line.batchId);
  return { ok: true, message: `Paystack status: ${status}.` };
}

/** One SMS code can release one transfer. A payroll split into several transfers is rejected instead. */
export async function finalizeDisbursementBatchOtp(
  batchId: string,
  otp: string,
  actor: DisburseActor,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const lines = await prisma.payrollDisbursementLine.findMany({
    where: {
      batchId,
      status: PayrollDisbursementLineStatus.SENDING,
      transferCode: { not: null },
      failureReason: { contains: "verification code" },
    },
    orderBy: { createdAt: "asc" },
  });
  if (lines.length === 0) {
    return { ok: false, error: "This payroll is not waiting on a Paystack code." };
  }
  if (lines.length > 1) {
    return {
      ok: false,
      error:
        "This payroll was sent as a separate transfer per person, so one code cannot release all of them. Reject it. Do not generate the month again.",
    };
  }
  return finalizeDisbursementLineOtp(lines[0].id, otp, actor);
}

/**
 * Stop a payroll before anyone is paid. A note is stored for HR.
 * Drafts waiting for approval have not reserved float. A batch still on a Paystack code has, so that float is returned.
 */
export async function rejectDisbursementBatch(
  batchId: string,
  note: string,
  actor: DisburseActor,
): Promise<
  | {
      ok: true;
      tenantId: string;
      tenantSlug: string;
      tenantName: string;
      periodLabel: string;
      payslipRunId: string;
      alreadyPaidNames: string[];
    }
  | { ok: false; error: string }
> {
  const reason = note.trim();
  if (reason.length < 4) return { ok: false, error: "Write a short note for HR about what does not match." };
  if (reason.length > 500) return { ok: false, error: "Keep the note under 500 characters." };

  const batch = await prisma.payrollDisbursementBatch.findUnique({
    where: { id: batchId },
    include: {
      tenant: { select: { id: true, slug: true, name: true } },
      run: { select: { label: true, year: true, month: true } },
      lines: true,
    },
  });
  if (!batch) return { ok: false, error: "Batch not found." };
  const alreadyPaidNames = batch.lines
    .filter((line) => line.status === PayrollDisbursementLineStatus.SUCCESS)
    .map((line) => line.accountName);
  const waitingForCode = batch.lines.some(
    (line) =>
      line.status === PayrollDisbursementLineStatus.SENDING &&
      Boolean(line.transferCode) &&
      (line.failureReason || "").toLowerCase().includes("verification code"),
  );
  const notStarted = batch.status === PayrollDisbursementBatchStatus.DRAFT && !batch.startedAt;
  const canStopUnpaid =
    (batch.status === PayrollDisbursementBatchStatus.SENDING ||
      batch.status === PayrollDisbursementBatchStatus.PARTIAL) &&
    waitingForCode;
  if (!notStarted && !canStopUnpaid) {
    return {
      ok: false,
      error: "This payroll has already been sent to Paystack. Reject it only while it is waiting for approval or a confirmation code.",
    };
  }

  if (batch.startedAt) {
    for (const line of batch.lines) {
      if (
        line.status !== PayrollDisbursementLineStatus.PENDING &&
        line.status !== PayrollDisbursementLineStatus.SENDING
      ) {
        continue;
      }
      await reverseLineOnLedger(batch.tenantId, line, actor);
      await prisma.payrollDisbursementLine.update({
        where: { id: line.id },
        data: { failureReason: reason.slice(0, 500) },
      });
    }
  } else {
    await prisma.payrollDisbursementLine.updateMany({
      where: {
        batchId: batch.id,
        status: { in: [PayrollDisbursementLineStatus.PENDING, PayrollDisbursementLineStatus.SENDING] },
      },
      data: {
        status: PayrollDisbursementLineStatus.FAILED,
        failureReason: reason.slice(0, 500),
      },
    });
  }

  await refreshBatchCounts(batch.id);
  await prisma.payrollDisbursementBatch.update({
    where: { id: batch.id },
    data: {
      ...(alreadyPaidNames.length === 0
        ? { status: PayrollDisbursementBatchStatus.CANCELLED, completedAt: new Date() }
        : {}),
      lastError: reason.slice(0, 500),
    },
  });

  return {
    ok: true,
    tenantId: batch.tenant.id,
    tenantSlug: batch.tenant.slug,
    tenantName: batch.tenant.name,
    periodLabel:
      batch.run?.label ||
      `${batch.run?.year ?? ""}-${String(batch.run?.month ?? "").padStart(2, "0")}`,
    payslipRunId: batch.payslipRunId,
    alreadyPaidNames,
  };
}

export async function resendDisbursementLineOtp(
  lineId: string,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const line = await prisma.payrollDisbursementLine.findUnique({ where: { id: lineId } });
  if (!line?.transferCode || line.status !== PayrollDisbursementLineStatus.SENDING) {
    return { ok: false, error: "This payout is not waiting on a Paystack code." };
  }
  const resent = await paystackResendTransferOtp(line.transferCode);
  if (!resent.ok) return { ok: false, error: resent.error };
  return { ok: true, message: "Paystack sent a new code to the business phone." };
}

export async function refreshBatchCounts(batchId: string) {
  const lines = await prisma.payrollDisbursementLine.groupBy({
    by: ["status"],
    where: { batchId },
    _count: true,
  });
  const count = (s: PayrollDisbursementLineStatus) =>
    lines.find((l) => l.status === s)?._count ?? 0;

  const success = count(PayrollDisbursementLineStatus.SUCCESS);
  const failed =
    count(PayrollDisbursementLineStatus.FAILED) + count(PayrollDisbursementLineStatus.REVERSED);
  const skipped = count(PayrollDisbursementLineStatus.SKIPPED);
  const sending = count(PayrollDisbursementLineStatus.SENDING) + count(PayrollDisbursementLineStatus.PENDING);
  const total = lines.reduce((n, l) => n + l._count, 0);

  let status: PayrollDisbursementBatchStatus = PayrollDisbursementBatchStatus.SENDING;
  if (sending === 0) {
    if (failed === 0 && success > 0) status = PayrollDisbursementBatchStatus.COMPLETED;
    else if (success === 0 && failed > 0) status = PayrollDisbursementBatchStatus.FAILED;
    else if (success > 0 && failed > 0) status = PayrollDisbursementBatchStatus.PARTIAL;
    else if (skipped === total) status = PayrollDisbursementBatchStatus.FAILED;
    else status = PayrollDisbursementBatchStatus.COMPLETED;
  }

  await prisma.payrollDisbursementBatch.update({
    where: { id: batchId },
    data: {
      successCount: success,
      failedCount: failed,
      skippedCount: skipped,
      status,
      completedAt: sending === 0 ? new Date() : null,
    },
  });
}

/** Apply Paystack transfer webhook to a matching line. */
export async function applyPaystackTransferWebhook(payload: {
  event: string;
  data?: {
    reference?: string;
    transfer_code?: string;
    status?: string;
    id?: number;
    reason?: string;
    complete_message?: string;
  };
}): Promise<{ ok: true; handled: boolean } | { ok: false; error: string }> {
  const reference = payload.data?.reference?.trim();
  if (!reference) return { ok: true, handled: false };

  const line = await prisma.payrollDisbursementLine.findFirst({
    where: { providerReference: reference },
  });
  if (!line) return { ok: true, handled: false };

  const event = payload.event;
  const status = (payload.data?.status || "").toLowerCase();

  if (event === "transfer.success" || status === "success") {
    if (line.status === PayrollDisbursementLineStatus.SUCCESS) {
      return { ok: true, handled: true };
    }
    await markLineSuccess(
      line,
      payload.data?.transfer_code,
      payload.data?.id != null ? String(payload.data.id) : "",
      "Paystack",
    );
    await refreshBatchCounts(line.batchId);
    return { ok: true, handled: true };
  }

  if (event === "transfer.failed" || event === "transfer.reversed" || status === "failed" || status === "reversed") {
    if (
      line.status === PayrollDisbursementLineStatus.FAILED ||
      line.status === PayrollDisbursementLineStatus.REVERSED
    ) {
      return { ok: true, handled: true };
    }
    const reason =
      payload.data?.complete_message || payload.data?.reason || event || "Transfer failed";
    await markLineFailed(line.id, reason);
    await reverseLineOnLedger(
      line.tenantId,
      line,
      { userId: "paystack-webhook", label: "Paystack webhook" },
    );
    await refreshBatchCounts(line.batchId);
    return { ok: true, handled: true };
  }

  return { ok: true, handled: false };
}
