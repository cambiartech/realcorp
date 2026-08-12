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
  employerCost?: number;
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
    employerCost: result.employerCost,
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
  chargeableIncome?: { toString(): string } | number;
  employerCost?: { toString(): string } | number;
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
  };
}
