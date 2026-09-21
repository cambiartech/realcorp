/**
 * Employee salary bank destination — JSON on EmployeeProfile.bankAccount.
 * Disbursement-ready requires NUBAN + bank code (for Paystack/Flutterwave).
 */

export type SalaryBankAccount = {
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  /** CBN / provider bank code (e.g. "058"). Required for rail payouts. */
  bankCode: string;
  accountType: string;
  receivePayments: boolean;
};

export type BankParseResult =
  | { ok: true; account: SalaryBankAccount; disbursementReady: boolean; warnings: string[] }
  | { ok: false; error: string };

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Normalize a Nigerian NUBAN: digits only, length 10. */
export function normalizeNuban(raw: string): { ok: true; accountNumber: string } | { ok: false; error: string } {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 10) {
    return { ok: false, error: "Account number must be a 10-digit NUBAN." };
  }
  return { ok: true, accountNumber: digits };
}

export function normalizeBankCode(raw: string): { ok: true; bankCode: string } | { ok: false; error: string } {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 3 || digits.length > 6) {
    return { ok: false, error: "Bank code must be 3–6 digits." };
  }
  return { ok: true, bankCode: digits };
}

export function parseSalaryBankAccount(raw: unknown): BankParseResult {
  if (raw == null) {
    return { ok: false, error: "No bank account on file." };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Bank account data is invalid." };
  }
  const o = raw as Record<string, unknown>;
  const accountHolderName = asString(o.accountHolderName);
  const bankName = asString(o.bankName);
  const accountType = asString(o.accountType) || "Checking";
  const receivePayments = o.receivePayments === true || o.receivePayments === "yes";

  const nuban = normalizeNuban(asString(o.accountNumber));
  if (!nuban.ok) return { ok: false, error: nuban.error };

  const bankCodeRaw = asString(o.bankCode);
  const warnings: string[] = [];
  let bankCode = "";
  if (bankCodeRaw) {
    const code = normalizeBankCode(bankCodeRaw);
    if (!code.ok) return { ok: false, error: code.error };
    bankCode = code.bankCode;
  } else {
    warnings.push("Bank code is missing — required before automated disbursement.");
  }

  if (!accountHolderName) warnings.push("Account holder name is missing.");
  if (!bankName) warnings.push("Bank name is missing.");
  if (!receivePayments) warnings.push("Employee is marked as not receiving payments.");

  const account: SalaryBankAccount = {
    accountHolderName,
    bankName,
    accountNumber: nuban.accountNumber,
    bankCode,
    accountType,
    receivePayments,
  };

  const disbursementReady =
    Boolean(accountHolderName) &&
    Boolean(bankName) &&
    Boolean(bankCode) &&
    receivePayments &&
    nuban.accountNumber.length === 10;

  return { ok: true, account, disbursementReady, warnings };
}

export function salaryBankAccountToJson(account: SalaryBankAccount): SalaryBankAccount {
  return { ...account };
}
