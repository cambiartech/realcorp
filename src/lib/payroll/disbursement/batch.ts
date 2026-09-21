import {
  HrPayslipPaymentStatus,
  HrPayslipRunStatus,
  PayrollDisbursementBatchStatus,
  PayrollDisbursementLineStatus,
  PayrollLedgerEntryType,
  type Prisma,
} from "@/generated/prisma";
import prisma from "@/lib/db";
import { parseSalaryBankAccount } from "./bank-account";
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
  paystackInitiateTransfer,
  paystackResolveAccount,
} from "./paystack";
import { estimatePaystackTransferFeeKobo } from "./provider-fees";
import { parsePayrollDisbursementSettings } from "./settings";

export type DisburseActor = {
  userId: string;
  label: string;
};

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/**
 * Build a DRAFT disbursement batch from a FINALIZED payslip run.
 * Does not move money — only validates bank data and totals.
 */
export async function createDisbursementBatchFromRun(
  tenantId: string,
  payslipRunId: string,
  actor: DisburseActor,
): Promise<{ ok: true; batchId: string } | { ok: false; error: string }> {
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

  for (const slip of run.payslips) {
    const net = decimalLikeToKobo(slip.netPay);
    if (net <= 0) {
      skipped += 1;
      continue;
    }
    const bank = parseSalaryBankAccount(slip.profile.bankAccount);
    const ref = `rcpay_${run.id.slice(-8)}_${slip.id.slice(-10)}_${Date.now().toString(36)}`.slice(0, 50);

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
        failureReason: bank.ok
          ? bank.warnings.join(" ") || "Bank details incomplete."
          : bank.error,
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
    return {
      ok: false,
      error:
        "No payslips are ready to disburse. Every unpaid slip needs a 10-digit NUBAN, bank code, and receive-payments = yes.",
    };
  }

  const idempotencyKey = `disburse:${run.id}:${monthKey(run.year, run.month)}:v1`;

  const existing = await prisma.payrollDisbursementBatch.findUnique({
    where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
  });
  if (existing && existing.status !== PayrollDisbursementBatchStatus.CANCELLED) {
    return { ok: true, batchId: existing.id };
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

  return { ok: true, batchId: batch.id };
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

  try {
    await prisma.$transaction(async (tx) => {
      const batch = await tx.payrollDisbursementBatch.findFirst({
        where: { id: batchId, tenantId },
      });
      if (!batch) throw new PayrollLedgerError("Batch not found.");
      await reserveBatchFunds(tx, batchId, actor);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not reserve funds.";
    return { ok: false, error: message };
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

  for (const line of lines) {
    await prisma.payrollDisbursementLine.update({
      where: { id: line.id },
      data: { status: PayrollDisbursementLineStatus.SENDING },
    });

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

    const amountKobo = decimalLikeToKobo(line.amount);
    const transfer = await paystackInitiateTransfer({
      amountKobo,
      recipientCode: recipient.data.recipient_code,
      reference: line.providerReference,
      reason: `Salary ${line.providerReference}`,
    });

    if (!transfer.ok) {
      await markLineFailed(line.id, transfer.error);
      await reverseLineOnLedger(tenantId, line, actor);
      failed += 1;
      continue;
    }

    const status = (transfer.data.status || "").toLowerCase();
    if (status === "success" || status === "pending" || status === "otp" || !status) {
      // pending/otp still in flight — webhook will confirm; treat pending as sent
      if (status === "success") {
        await markLineSuccess(line, transfer.data.transfer_code, String(transfer.data.id || ""), actor.label);
        success += 1;
      } else {
        await prisma.payrollDisbursementLine.update({
          where: { id: line.id },
          data: {
            recipientCode: recipient.data.recipient_code,
            accountNameResolved: resolve.data.account_name,
            transferCode: transfer.data.transfer_code || null,
            providerTransferId: transfer.data.id != null ? String(transfer.data.id) : null,
            status: PayrollDisbursementLineStatus.SENDING,
          },
        });
        // Count as in-flight; webhook finalizes. Don't reverse.
      }
    } else if (status === "failed" || status === "reversed") {
      await markLineFailed(line.id, `Paystack status: ${status}`);
      await reverseLineOnLedger(tenantId, line, actor);
      failed += 1;
    } else {
      await prisma.payrollDisbursementLine.update({
        where: { id: line.id },
        data: {
          recipientCode: recipient.data.recipient_code,
          accountNameResolved: resolve.data.account_name,
          transferCode: transfer.data.transfer_code || null,
          providerTransferId: transfer.data.id != null ? String(transfer.data.id) : null,
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
