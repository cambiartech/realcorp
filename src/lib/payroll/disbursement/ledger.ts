import type { PayrollLedgerEntryType, Prisma } from "@/generated/prisma";
import {
  applyLedgerDelta,
  decimalLikeToKobo,
  koboToNairaString,
  parseNairaToKobo,
} from "./money";

export type LedgerTx = Prisma.TransactionClient;

export class PayrollLedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayrollLedgerError";
  }
}

async function lockAndReadBalanceKobo(tx: LedgerTx, tenantId: string): Promise<number> {
  // Serialize all money moves for this tenant.
  await tx.$executeRaw`SELECT "id" FROM "Tenant" WHERE "id" = ${tenantId} FOR UPDATE`;

  const row = await tx.payrollTenantBalance.findUnique({ where: { tenantId } });
  if (!row) return 0;
  return decimalLikeToKobo(row.availableBalance);
}

async function upsertBalance(tx: LedgerTx, tenantId: string, balanceKobo: number, currency: string) {
  const naira = koboToNairaString(balanceKobo);
  await tx.payrollTenantBalance.upsert({
    where: { tenantId },
    create: {
      tenantId,
      availableBalance: naira,
      currency,
    },
    update: {
      availableBalance: naira,
      currency,
    },
  });
}

export type PostLedgerEntryInput = {
  tenantId: string;
  entryType: PayrollLedgerEntryType;
  amountNaira: string | number;
  currency?: string;
  idempotencyKey: string;
  description: string;
  fundingReceiptId?: string;
  disbursementBatchId?: string;
  createdByUserId?: string | null;
  createdByLabel?: string | null;
};

/**
 * Append a ledger entry and update the cached Available balance in one transaction.
 * Idempotent: same (tenantId, idempotencyKey) returns the existing entry without changing balance.
 */
export async function postLedgerEntry(tx: LedgerTx, input: PostLedgerEntryInput) {
  const currency = input.currency || "NGN";
  const key = input.idempotencyKey.trim();
  if (!key) throw new PayrollLedgerError("Idempotency key is required.");

  const amount = parseNairaToKobo(input.amountNaira);
  if (!amount.ok) throw new PayrollLedgerError(amount.error);

  // Lock first so concurrent posts (incl. same idempotency key) serialize.
  const balanceKobo = await lockAndReadBalanceKobo(tx, input.tenantId);

  const existing = await tx.payrollLedgerEntry.findUnique({
    where: { tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: key } },
  });
  if (existing) {
    return { entry: existing, created: false as const };
  }

  const next = applyLedgerDelta({
    balanceKobo,
    entryType: input.entryType,
    amountKobo: amount.kobo,
  });
  if (!next.ok) throw new PayrollLedgerError(next.error);

  try {
    const entry = await tx.payrollLedgerEntry.create({
      data: {
        tenantId: input.tenantId,
        entryType: input.entryType,
        amount: amount.naira,
        currency,
        balanceAfter: koboToNairaString(next.balanceAfterKobo),
        fundingReceiptId: input.fundingReceiptId,
        disbursementBatchId: input.disbursementBatchId,
        idempotencyKey: key,
        description: input.description.trim() || input.entryType,
        createdByUserId: input.createdByUserId || undefined,
        createdByLabel: input.createdByLabel || undefined,
      },
    });

    await upsertBalance(tx, input.tenantId, next.balanceAfterKobo, currency);

    return { entry, created: true as const };
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      const raced = await tx.payrollLedgerEntry.findUnique({
        where: { tenantId_idempotencyKey: { tenantId: input.tenantId, idempotencyKey: key } },
      });
      if (raced) return { entry: raced, created: false as const };
    }
    throw err;
  }
}

export async function getAvailableBalanceKobo(
  tx: { payrollTenantBalance: LedgerTx["payrollTenantBalance"] },
  tenantId: string,
): Promise<number> {
  const row = await tx.payrollTenantBalance.findUnique({ where: { tenantId } });
  if (!row) return 0;
  return decimalLikeToKobo(row.availableBalance);
}

export async function getAvailableBalanceNaira(
  tx: { payrollTenantBalance: LedgerTx["payrollTenantBalance"] },
  tenantId: string,
): Promise<string> {
  return koboToNairaString(await getAvailableBalanceKobo(tx, tenantId));
}
