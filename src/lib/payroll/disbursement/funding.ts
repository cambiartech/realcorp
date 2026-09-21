import { PayrollFundingStatus } from "@/generated/prisma";
import { PayrollLedgerError, postLedgerEntry, type LedgerTx } from "./ledger";
import { parseNairaToKobo } from "./money";

export type FundingActor = {
  userId: string;
  label: string;
};

function normalizePaymentReference(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

export type SubmitFundingInput = {
  tenantId: string;
  amountNaira: string | number;
  paymentReference: string;
  currency?: string;
  senderName?: string;
  senderBank?: string;
  bankReceivedAt?: Date | null;
  notes?: string;
  actor: FundingActor;
};

/** Tenant or ops records “we transferred / we saw inbound”. Does NOT credit Available. */
export async function submitFundingReceipt(tx: LedgerTx, input: SubmitFundingInput) {
  const amount = parseNairaToKobo(input.amountNaira);
  if (!amount.ok) throw new PayrollLedgerError(amount.error);
  if (amount.kobo <= 0) throw new PayrollLedgerError("Funding amount must be greater than zero.");

  const paymentReference = normalizePaymentReference(input.paymentReference);
  if (paymentReference.length < 4) {
    throw new PayrollLedgerError("Payment reference must be at least 4 characters.");
  }

  try {
    return await tx.payrollFundingReceipt.create({
      data: {
        tenantId: input.tenantId,
        amount: amount.naira,
        currency: input.currency || "NGN",
        paymentReference,
        senderName: input.senderName?.trim() || null,
        senderBank: input.senderBank?.trim() || null,
        bankReceivedAt: input.bankReceivedAt || null,
        notes: input.notes?.trim() || null,
        status: PayrollFundingStatus.PENDING,
        createdByUserId: input.actor.userId,
        createdByLabel: input.actor.label,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new PayrollLedgerError(
        `A funding receipt with reference "${paymentReference}" already exists for this organization.`,
      );
    }
    throw err;
  }
}

export type VerifyFundingInput = {
  tenantId: string;
  receiptId: string;
  actor: FundingActor;
  /** Optional override if ops corrects the verified amount (must still be > 0). */
  verifiedAmountNaira?: string | number;
};

/**
 * Platform/ops verifies bank credit → FUNDING_CREDIT on ledger.
 * Idempotent: re-verify of already VERIFIED receipt returns existing ledger entry.
 */
export async function verifyFundingReceipt(tx: LedgerTx, input: VerifyFundingInput) {
  const receipt = await tx.payrollFundingReceipt.findFirst({
    where: { id: input.receiptId, tenantId: input.tenantId },
    include: { ledgerEntry: true },
  });
  if (!receipt) throw new PayrollLedgerError("Funding receipt not found.");

  if (receipt.status === PayrollFundingStatus.VERIFIED) {
    if (receipt.ledgerEntry) {
      return { receipt, entry: receipt.ledgerEntry, created: false as const };
    }
    throw new PayrollLedgerError("Receipt is VERIFIED but has no ledger entry — contact engineering.");
  }

  if (receipt.status === PayrollFundingStatus.REJECTED) {
    throw new PayrollLedgerError("Rejected funding cannot be verified. Create a new receipt.");
  }
  if (receipt.status === PayrollFundingStatus.VOIDED) {
    throw new PayrollLedgerError("Voided funding cannot be verified.");
  }

  const amountSource = input.verifiedAmountNaira ?? receipt.amount.toString();
  const amount = parseNairaToKobo(amountSource);
  if (!amount.ok) throw new PayrollLedgerError(amount.error);
  if (amount.kobo <= 0) throw new PayrollLedgerError("Verified amount must be greater than zero.");

  const idempotencyKey = `funding:${receipt.id}`;

  const posted = await postLedgerEntry(tx, {
    tenantId: input.tenantId,
    entryType: "FUNDING_CREDIT",
    amountNaira: amount.naira,
    currency: receipt.currency,
    idempotencyKey,
    description: `Funding verified · ref ${receipt.paymentReference}`,
    fundingReceiptId: receipt.id,
    createdByUserId: input.actor.userId,
    createdByLabel: input.actor.label,
  });

  const updated = await tx.payrollFundingReceipt.update({
    where: { id: receipt.id },
    data: {
      status: PayrollFundingStatus.VERIFIED,
      amount: amount.naira,
      verifiedAt: new Date(),
      verifiedByUserId: input.actor.userId,
      verifiedByLabel: input.actor.label,
    },
  });

  return { receipt: updated, entry: posted.entry, created: posted.created };
}

export type RejectFundingInput = {
  tenantId: string;
  receiptId: string;
  reason: string;
  actor: FundingActor;
};

export async function rejectFundingReceipt(tx: LedgerTx, input: RejectFundingInput) {
  const reason = input.reason.trim();
  if (reason.length < 3) throw new PayrollLedgerError("Rejection reason is required.");

  const receipt = await tx.payrollFundingReceipt.findFirst({
    where: { id: input.receiptId, tenantId: input.tenantId },
  });
  if (!receipt) throw new PayrollLedgerError("Funding receipt not found.");
  if (receipt.status === PayrollFundingStatus.VERIFIED) {
    throw new PayrollLedgerError("Verified funding cannot be rejected. Use a reversing adjustment.");
  }
  if (receipt.status === PayrollFundingStatus.VOIDED) {
    throw new PayrollLedgerError("Voided funding cannot be rejected.");
  }
  if (receipt.status === PayrollFundingStatus.REJECTED) {
    return receipt;
  }

  return tx.payrollFundingReceipt.update({
    where: { id: receipt.id },
    data: {
      status: PayrollFundingStatus.REJECTED,
      rejectedAt: new Date(),
      rejectedByUserId: input.actor.userId,
      rejectedByLabel: input.actor.label,
      rejectionReason: reason,
    },
  });
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}
