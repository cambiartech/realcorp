import { PayrollFundingStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import {
  matchDedicatedAccountTenant,
  parseDedicatedAccountCredit,
  type DedicatedAccountCredit,
} from "./dedicated-account-credit";
import { submitFundingReceipt, verifyFundingReceipt } from "./funding";
import { PayrollLedgerError, type LedgerTx } from "./ledger";
import { koboToNairaString } from "./money";
import { parsePayrollDisbursementSettings } from "./settings";

const PAYSTACK_ACTOR = { userId: "paystack", label: "Paystack" };

async function creditTenantFloat(tx: LedgerTx, tenantId: string, credit: DedicatedAccountCredit) {
  const paymentReference = credit.reference.replace(/\s+/g, " ").toUpperCase();
  let receipt = await tx.payrollFundingReceipt.findFirst({
    where: { tenantId, paymentReference },
  });

  if (!receipt) {
    try {
      receipt = await submitFundingReceipt(tx, {
        tenantId,
        amountNaira: koboToNairaString(credit.amountKobo),
        paymentReference,
        currency: credit.currency || "NGN",
        senderName: credit.senderName || undefined,
        senderBank: credit.senderBank || undefined,
        bankReceivedAt: credit.paidAt,
        notes: credit.accountNumber
          ? `Paystack dedicated account ${credit.accountNumber}`
          : "Paystack dedicated account",
        actor: PAYSTACK_ACTOR,
      });
    } catch (err) {
      if (!(err instanceof PayrollLedgerError) || !/already exists/i.test(err.message)) throw err;
      receipt = await tx.payrollFundingReceipt.findFirst({
        where: { tenantId, paymentReference },
      });
    }
  }

  if (!receipt) throw new PayrollLedgerError("Funding receipt was not created.");
  if (receipt.status === PayrollFundingStatus.VERIFIED) return;

  await verifyFundingReceipt(tx, {
    tenantId,
    receiptId: receipt.id,
    actor: PAYSTACK_ACTOR,
  });
}

export async function applyPaystackDedicatedAccountWebhook(input: {
  event: string;
  data?: Record<string, unknown>;
}): Promise<{ ok: true; handled: boolean } | { ok: false; error: string }> {
  const credit = parseDedicatedAccountCredit(input.event, input.data);
  if (!credit) return { ok: true, handled: false };

  const rows = await prisma.tenantSettings.findMany({
    select: { tenantId: true, payrollDisbursementSettings: true },
  });
  const match = matchDedicatedAccountTenant(
    credit,
    rows.map((row) => ({
      tenantId: row.tenantId,
      settings: parsePayrollDisbursementSettings(row.payrollDisbursementSettings),
    })),
  );
  if (!match.ok) return { ok: true, handled: false };

  try {
    await prisma.$transaction((tx) => creditTenantFloat(tx, match.tenantId, credit));
    return { ok: true, handled: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not credit dedicated account payment.";
    return { ok: false, error: message };
  }
}
