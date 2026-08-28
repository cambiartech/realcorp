export const FINANCE_INCOME_TYPES = [
  "CLIENT_DEPOSIT",
  "MILESTONE",
  "SHORTLET_REVENUE",
  "SERVICE_FEE",
  "OTHER",
] as const;

export type FinanceIncomeType = (typeof FINANCE_INCOME_TYPES)[number];

export const FINANCE_INCOME_TYPE_LABELS: Record<FinanceIncomeType, string> = {
  CLIENT_DEPOSIT: "Client deposit",
  MILESTONE: "Milestone / installment",
  SHORTLET_REVENUE: "Short let",
  SERVICE_FEE: "Service fee",
  OTHER: "Other income",
};

export function isFinanceIncomeType(value: string): value is FinanceIncomeType {
  return (FINANCE_INCOME_TYPES as readonly string[]).includes(value);
}

export function parseFinanceIncomeType(value: unknown): FinanceIncomeType {
  const raw = String(value || "").trim().toUpperCase();
  return isFinanceIncomeType(raw) ? raw : "OTHER";
}

/** Income generated on a property (e.g. short-let stays), not money the client paid toward a sale. */
export function isPropertyEarningIncomeType(value: unknown): boolean {
  return parseFinanceIncomeType(value) === "SHORTLET_REVENUE";
}

/** Estate / management fee on a unit — tracked separately from the sale balance. */
export function isServiceFeeIncomeType(value: unknown): boolean {
  return parseFinanceIncomeType(value) === "SERVICE_FEE";
}

export function allocateClientCash(incomeType: unknown, amount: number) {
  const value = money(Number(amount) || 0);
  if (isPropertyEarningIncomeType(incomeType)) {
    return { collected: 0, earnings: value, serviceFeePaid: 0, isDeposit: false };
  }
  if (isServiceFeeIncomeType(incomeType)) {
    return { collected: 0, earnings: 0, serviceFeePaid: value, isDeposit: false };
  }
  return {
    collected: value,
    earnings: 0,
    serviceFeePaid: 0,
    isDeposit: parseFinanceIncomeType(incomeType) === "CLIENT_DEPOSIT",
  };
}

/** Unit service fee when set; otherwise the project’s estate service charge. */
export function resolveUnitServiceFee(
  unitFee: number | null | undefined,
  projectFee: number | null | undefined,
) {
  if (unitFee != null && Number.isFinite(Number(unitFee)) && Number(unitFee) >= 0) {
    return money(Number(unitFee));
  }
  return money(Number(projectFee) || 0);
}

export function remainingClientBalance(input: {
  contractValue: number;
  collected: number;
}) {
  return Math.max(0, money(input.contractValue) - money(input.collected));
}

/** Catch-up / opening position: sale price is what they still owe plus everything already paid. */
export function agreedPriceFromCatchUp(input: {
  alreadyOnFile: number;
  openingPaid: number;
  payingNow: number;
  remainingToPay: number;
}) {
  return money(
    Number(input.alreadyOnFile || 0) +
      Number(input.openingPaid || 0) +
      Number(input.payingNow || 0) +
      Number(input.remainingToPay || 0),
  );
}

/** Brochure / list price vs the amount this client is actually expected to pay. */
export function resolveClientUnitSalePrice(input: {
  agreedPrice?: number | null;
  dealValue?: number | null;
  listPrice?: number | null;
}) {
  const listPrice = money(Number(input.listPrice) || Number(input.dealValue) || 0);
  const agreedRaw = input.agreedPrice;
  const hasAgreed = agreedRaw != null && Number.isFinite(Number(agreedRaw)) && Number(agreedRaw) >= 0;
  const salePrice = hasAgreed ? money(Number(agreedRaw)) : money(Number(input.dealValue) || listPrice);
  return {
    listPrice,
    salePrice,
    isDiscounted: listPrice > 0 && salePrice + 0.001 < listPrice,
  };
}

export type ClientDepositTotals = {
  contractValue: number;
  collected: number;
  remaining: number;
  earnings: number;
  serviceFee: number;
  serviceFeePaid: number;
  serviceFeeRemaining: number;
};

export function summarizeClientDeposits(
  rows: Array<{
    contractValue: number;
    collected: number;
    remaining: number;
    earnings?: number;
    serviceFee?: number;
    serviceFeePaid?: number;
    serviceFeeRemaining?: number;
  }>,
): ClientDepositTotals {
  return rows.reduce<ClientDepositTotals>(
    (acc, row) => {
      acc.contractValue = money(acc.contractValue + row.contractValue);
      acc.collected = money(acc.collected + row.collected);
      acc.remaining = money(acc.remaining + row.remaining);
      acc.earnings = money(acc.earnings + (row.earnings || 0));
      acc.serviceFee = money(acc.serviceFee + (row.serviceFee || 0));
      acc.serviceFeePaid = money(acc.serviceFeePaid + (row.serviceFeePaid || 0));
      acc.serviceFeeRemaining = money(acc.serviceFeeRemaining + (row.serviceFeeRemaining || 0));
      return acc;
    },
    {
      contractValue: 0,
      collected: 0,
      remaining: 0,
      earnings: 0,
      serviceFee: 0,
      serviceFeePaid: 0,
      serviceFeeRemaining: 0,
    },
  );
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Org operating result: collections in, expenses and owner remittances out. */
export function operatingNet(input: {
  collected: number;
  expenses: number;
  remitted?: number;
}) {
  return money(
    Number(input.collected || 0) - Number(input.expenses || 0) - Number(input.remitted || 0),
  );
}
