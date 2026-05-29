import { normalizeFinanceOptionList } from "@/lib/finance-catalog";

export type ParsedBankAccount = {
  bankName: string;
  accountNumber: string;
  accountName: string;
  label: string;
};

export function parseBankAccounts(value: unknown): ParsedBankAccount[] {
  return normalizeFinanceOptionList(value)
    .map(parseBankAccountLine)
    .filter((x): x is ParsedBankAccount => x !== null);
}

export function parseBankAccountLine(line: string): ParsedBankAccount | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const parts = trimmed.split("|").map((x) => x.trim());
  if (parts.length >= 3) {
    return {
      bankName: parts[0] || "Bank",
      accountNumber: parts[1] || "—",
      accountName: parts[2] || "—",
      label: trimmed,
    };
  }

  return {
    bankName: trimmed,
    accountNumber: "—",
    accountName: "—",
    label: trimmed,
  };
}

export function formatBankAccountsForHtml(accounts: ParsedBankAccount[]): string {
  if (accounts.length === 0) return "";
  const rows = accounts
    .map(
      (a) =>
        `<li style="margin:0 0 8px"><strong>${a.bankName}</strong><br/>Acct: ${a.accountNumber}<br/>Name: ${a.accountName}</li>`,
    )
    .join("");
  return `<ul style="margin:8px 0 0;padding-left:18px;font-size:14px;line-height:1.5">${rows}</ul>`;
}

export function formatBankAccountsForPdf(accounts: ParsedBankAccount[]): string[] {
  if (accounts.length === 0) return [];
  const lines: string[] = [];
  for (const a of accounts) {
    lines.push(`${a.bankName} — ${a.accountNumber} (${a.accountName})`);
  }
  return lines;
}

export const FINANCE_SETTINGS_BANKS_HINT =
  "Add bank / cash accounts under Finance → Settings so customers know where to pay.";
