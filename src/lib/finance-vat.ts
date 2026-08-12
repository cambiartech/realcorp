export type FinanceVatTreatment = "NONE" | "EXCLUSIVE" | "INCLUSIVE" | "EXEMPT" | "ZERO_RATED";

export function calculateVatBreakdown(input: {
  amount: number;
  treatment: FinanceVatTreatment;
  rate: number;
}) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }
  if (!Number.isFinite(input.rate) || input.rate < 0 || input.rate > 100) {
    throw new Error("VAT rate must be between 0% and 100%.");
  }

  if (
    input.treatment === "NONE" ||
    input.treatment === "EXEMPT" ||
    input.treatment === "ZERO_RATED"
  ) {
    return { subtotal: money(input.amount), vatAmount: 0, grossAmount: money(input.amount), vatRate: 0 };
  }

  if (input.treatment === "EXCLUSIVE") {
    const subtotal = money(input.amount);
    const vatAmount = money(subtotal * (input.rate / 100));
    return { subtotal, vatAmount, grossAmount: money(subtotal + vatAmount), vatRate: input.rate };
  }

  const grossAmount = money(input.amount);
  const subtotal = money(grossAmount / (1 + input.rate / 100));
  return {
    subtotal,
    vatAmount: money(grossAmount - subtotal),
    grossAmount,
    vatRate: input.rate,
  };
}

export function expensePnlAmount(input: {
  grossAmount: number;
  subtotal: number;
  vatRecoverable: boolean;
}) {
  return money(input.vatRecoverable ? input.subtotal : input.grossAmount);
}

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
