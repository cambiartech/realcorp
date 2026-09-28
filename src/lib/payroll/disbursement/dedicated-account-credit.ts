import { normalizeNuban } from "./bank-account";
import type { PayrollDisbursementSettings } from "./settings";

export type DedicatedAccountCredit = {
  reference: string;
  amountKobo: number;
  currency: string;
  customerCode: string;
  accountNumber: string;
  senderName: string;
  senderBank: string;
  paidAt: Date | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function accountDigits(raw: string): string {
  const parsed = normalizeNuban(raw);
  return parsed.ok ? parsed.accountNumber : "";
}

/**
 * Paystack Dedicated NUBAN credits arrive as charge.success, channel dedicated_nuban.
 * Amount is kobo. Returns null for every other event.
 */
export function parseDedicatedAccountCredit(
  event: string,
  data: unknown,
): DedicatedAccountCredit | null {
  if (event !== "charge.success") return null;
  const row = asRecord(data);
  if (!row) return null;
  if (asString(row.status) && asString(row.status) !== "success") return null;

  const authorization = asRecord(row.authorization);
  const dedicated = asRecord(row.dedicated_account);
  const channel = asString(row.channel) || asString(authorization?.channel);
  if (channel !== "dedicated_nuban") return null;

  const amount = row.amount;
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) return null;

  const reference = asString(row.reference) || (typeof row.id === "number" ? `paystack-${row.id}` : "");
  if (reference.length < 4) return null;

  const customer = asRecord(row.customer);
  const accountNumber = accountDigits(
    asString(authorization?.receiver_bank_account_number) ||
      asString(authorization?.account_number) ||
      asString(dedicated?.account_number),
  );
  const paidRaw = asString(row.paid_at) || asString(row.paidAt);
  const paidAt = paidRaw ? new Date(paidRaw) : null;

  return {
    reference,
    amountKobo: amount,
    currency: asString(row.currency) || "NGN",
    customerCode: asString(customer?.customer_code),
    accountNumber,
    senderName: asString(authorization?.sender_name) || asString(customer?.first_name),
    senderBank: asString(authorization?.sender_bank) || asString(authorization?.bank),
    paidAt: paidAt && !Number.isNaN(paidAt.getTime()) ? paidAt : null,
  };
}

export function matchDedicatedAccountTenant(
  credit: Pick<DedicatedAccountCredit, "customerCode" | "accountNumber">,
  tenants: Array<{ tenantId: string; settings: PayrollDisbursementSettings }>,
): { ok: true; tenantId: string } | { ok: false; reason: "none" | "ambiguous" } {
  const customerCode = credit.customerCode.trim();
  const accountNumber = accountDigits(credit.accountNumber);

  const paystackTenants = tenants.filter((tenant) => {
    const provider = tenant.settings.dvaProvider;
    return !provider || provider === "PAYSTACK";
  });

  if (customerCode) {
    const byCustomer = paystackTenants.filter(
      (tenant) => tenant.settings.dvaCustomerCode?.trim() === customerCode,
    );
    if (byCustomer.length === 1) return { ok: true, tenantId: byCustomer[0].tenantId };
    if (byCustomer.length > 1) return { ok: false, reason: "ambiguous" };
  }

  if (accountNumber) {
    const byAccount = paystackTenants.filter(
      (tenant) => accountDigits(tenant.settings.dvaAccountNumber || "") === accountNumber,
    );
    if (byAccount.length === 1) return { ok: true, tenantId: byAccount[0].tenantId };
    if (byAccount.length > 1) return { ok: false, reason: "ambiguous" };
  }

  return { ok: false, reason: "none" };
}
