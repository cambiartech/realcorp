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

export function summarizeClientDeposits(
  rows: Array<{ contractValue: number; collected: number; remaining: number }>,
) {
  return rows.reduce(
    (acc, row) => {
      acc.contractValue = money(acc.contractValue + row.contractValue);
      acc.collected = money(acc.collected + row.collected);
      acc.remaining = money(acc.remaining + row.remaining);
      return acc;
    },
    { contractValue: 0, collected: 0, remaining: 0 },
  );
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
