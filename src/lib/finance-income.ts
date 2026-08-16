export const FINANCE_INCOME_TYPES = [
  "CLIENT_DEPOSIT",
  "MILESTONE",
  "SHORTLET_REVENUE",
  "OTHER",
] as const;

export type FinanceIncomeType = (typeof FINANCE_INCOME_TYPES)[number];

export const FINANCE_INCOME_TYPE_LABELS: Record<FinanceIncomeType, string> = {
  CLIENT_DEPOSIT: "Client deposit",
  MILESTONE: "Milestone / installment",
  SHORTLET_REVENUE: "Short let",
  OTHER: "Other income",
};

export function isFinanceIncomeType(value: string): value is FinanceIncomeType {
  return (FINANCE_INCOME_TYPES as readonly string[]).includes(value);
}

export function parseFinanceIncomeType(value: unknown): FinanceIncomeType {
  const raw = String(value || "").trim().toUpperCase();
  return isFinanceIncomeType(raw) ? raw : "OTHER";
}

export function remainingClientBalance(input: {
  contractValue: number;
  collected: number;
}) {
  return Math.max(0, money(input.contractValue) - money(input.collected));
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
