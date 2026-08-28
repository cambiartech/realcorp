import { calculatePayroll, type PayrollPriorYtd } from "./payroll/engine";

export type PayslipEarningLine = ReturnType<typeof calculatePayroll>["earnings"][number];
export type PayslipDeductionLine = ReturnType<typeof calculatePayroll>["deductions"][number];

export type PayslipCalculation = {
  grossPay: number;
  earnings: PayslipEarningLine[];
  deductions: PayslipDeductionLine[];
  payeeTax: number;
  pensionDeduction: number;
  otherDeductions: number;
  netPay: number;
  jurisdictionCode?: string;
  ruleVersion?: string;
  chargeableIncome?: number;
  projectedAnnualTax?: number;
  projectedAnnualChargeableIncome?: number;
  employerCost?: number;
  employerContributions?: Array<{
    code: string;
    label: string;
    amount: number;
    paidBy: "EMPLOYER";
  }>;
  appliedTaxBands?: Array<{
    label: string;
    rate: number;
    incomeInBand: number;
    taxInBand: number;
  }>;
  taxOverrideApplied?: boolean;
  taxOverrideReason?: string | null;
};

/**
 * Compatibility adapter for existing HR views. New payroll generation should use
 * calculatePayroll directly so jurisdiction and statutory settings stay explicit.
 */
export function calculateNigeriaPayslip(input: {
  grossMonthly: number;
  basicPercent?: number;
  housingPercent?: number;
  transportPercent?: number;
  otherPercent?: number;
  payeeTax?: number;
  pensionRate?: number;
  otherDeductions?: number;
  year?: number;
  month?: number;
  priorYtd?: PayrollPriorYtd;
}): PayslipCalculation {
  const result = calculatePayroll({
    countryCode: "NG",
    year: input.year ?? 2026,
    month: input.month ?? 1,
    grossMonthly: input.grossMonthly,
    basicPercent: input.basicPercent,
    housingPercent: input.housingPercent,
    transportPercent: input.transportPercent,
    otherPercent: input.otherPercent,
    employeePensionRate:
      input.pensionRate === undefined ? undefined : input.pensionRate <= 1 ? input.pensionRate * 100 : input.pensionRate,
    otherPostTaxMonthly: input.otherDeductions,
    taxOverrideMonthly: input.payeeTax,
    priorYtd: input.priorYtd,
  });

  return {
    grossPay: result.grossPay,
    earnings: result.earnings,
    deductions: result.deductions,
    payeeTax: result.tax,
    pensionDeduction: result.employeePension,
    otherDeductions: result.otherDeductions,
    netPay: result.netPay,
    jurisdictionCode: result.jurisdictionCode,
    ruleVersion: result.ruleVersion,
    chargeableIncome: result.chargeableIncome,
    projectedAnnualTax: result.projectedAnnualTax,
    projectedAnnualChargeableIncome: result.projectedAnnualChargeableIncome,
    employerCost: result.employerCost,
    employerContributions: result.employerContributions,
    appliedTaxBands: Array.isArray(result.calculationBreakdown.appliedTaxBands)
      ? (result.calculationBreakdown.appliedTaxBands as PayslipCalculation["appliedTaxBands"])
      : undefined,
    taxOverrideApplied: result.taxOverrideApplied,
    taxOverrideReason: result.taxOverrideReason,
  };
}

/** Rehydrates the immutable values stored when payroll was generated. */
export function payslipCalculationFromStored(input: {
  grossPay: { toString(): string } | number;
  payeeTax: { toString(): string } | number;
  pensionDeduction: { toString(): string } | number;
  otherDeductions: { toString(): string } | number;
  netPay: { toString(): string } | number;
  earningsBreakdown: unknown;
  deductionsBreakdown: unknown;
  jurisdictionCode?: string;
  taxRuleVersion?: string | null;
  taxOverrideApplied?: boolean;
  taxOverrideReason?: string | null;
  chargeableIncome?: { toString(): string } | number;
  employerCost?: { toString(): string } | number;
  employerContributions?: unknown;
  calculationBreakdown?: unknown;
}): PayslipCalculation {
  return {
    grossPay: Number(input.grossPay),
    earnings: Array.isArray(input.earningsBreakdown)
      ? (input.earningsBreakdown as PayslipEarningLine[])
      : [],
    deductions: Array.isArray(input.deductionsBreakdown)
      ? (input.deductionsBreakdown as PayslipDeductionLine[])
      : [],
    payeeTax: Number(input.payeeTax),
    pensionDeduction: Number(input.pensionDeduction),
    otherDeductions: Number(input.otherDeductions),
    netPay: Number(input.netPay),
    jurisdictionCode: input.jurisdictionCode,
    ruleVersion: input.taxRuleVersion || undefined,
    chargeableIncome:
      input.chargeableIncome === undefined ? undefined : Number(input.chargeableIncome),
    employerCost: input.employerCost === undefined ? undefined : Number(input.employerCost),
    employerContributions: Array.isArray(input.employerContributions)
      ? (input.employerContributions as NonNullable<PayslipCalculation["employerContributions"]>)
      : undefined,
    ...payslipTaxBandsFromBreakdown(input.calculationBreakdown),
    taxOverrideApplied: Boolean(input.taxOverrideApplied),
    taxOverrideReason: input.taxOverrideReason || null,
  };
}

function payslipTaxBandsFromBreakdown(raw: unknown): Pick<
  PayslipCalculation,
  "appliedTaxBands" | "projectedAnnualChargeableIncome" | "projectedAnnualTax"
> {
  if (!raw || typeof raw !== "object") return {};
  const breakdown = raw as Record<string, unknown>;
  const applied = Array.isArray(breakdown.appliedTaxBands)
    ? breakdown.appliedTaxBands.filter(
        (band): band is NonNullable<PayslipCalculation["appliedTaxBands"]>[number] =>
          Boolean(band) && typeof band === "object",
      )
    : undefined;
  return {
    appliedTaxBands: applied,
    projectedAnnualChargeableIncome:
      typeof breakdown.projectedAnnualChargeableIncome === "number"
        ? breakdown.projectedAnnualChargeableIncome
        : undefined,
    projectedAnnualTax:
      typeof breakdown.projectedAnnualTax === "number" ? breakdown.projectedAnnualTax : undefined,
  };
}
