export type PayrollEarningLine = {
  code: string;
  label: string;
  percent: number | null;
  amount: number;
};

export type PayrollDeductionLine = {
  code: string;
  label: string;
  amount: number;
  timing: "PRE_TAX" | "TAX" | "POST_TAX";
};

export type PayrollContributionLine = {
  code: string;
  label: string;
  amount: number;
  paidBy: "EMPLOYER";
};

export type PayrollPriorYtd = {
  chargeableIncome: number;
  taxWithheld: number;
  monthsProcessed?: number;
};

export type PayrollCalculationInput = {
  countryCode: string;
  regionCode?: string | null;
  year: number;
  month: number;
  grossMonthly: number;
  basicPercent?: number;
  housingPercent?: number;
  transportPercent?: number;
  otherPercent?: number;
  employeePensionRate?: number;
  employerPensionRate?: number;
  pensionEnabled?: boolean;
  nhfMonthly?: number;
  nhiaMonthly?: number;
  annualRent?: number;
  annualLifeInsurance?: number;
  annualMortgageInterest?: number;
  otherPreTaxMonthly?: number;
  otherPostTaxMonthly?: number;
  variableEarnings?: Array<{
    code: string;
    label: string;
    amount: number;
    taxable: boolean;
    pensionable: boolean;
  }>;
  variableDeductions?: Array<{
    code: string;
    label: string;
    amount: number;
    preTax: boolean;
  }>;
  employerStatutoryContributions?: Array<{
    code: string;
    label: string;
    rate?: number;
    fixedAmount?: number;
  }>;
  taxOverrideMonthly?: number;
  taxOverrideReason?: string | null;
  priorYtd?: PayrollPriorYtd;
};

export type PayrollCalculation = {
  jurisdictionCode: string;
  ruleVersion: string;
  currency: string;
  grossPay: number;
  earnings: PayrollEarningLine[];
  deductions: PayrollDeductionLine[];
  employerContributions: PayrollContributionLine[];
  tax: number;
  employeePension: number;
  employerPension: number;
  otherDeductions: number;
  eligibleDeductions: number;
  chargeableIncome: number;
  projectedAnnualChargeableIncome: number;
  projectedAnnualTax: number;
  netPay: number;
  employerCost: number;
  taxOverrideApplied: boolean;
  taxOverrideReason: string | null;
  calculationBreakdown: Record<string, unknown>;
};

export type PayrollRuleSet = {
  countryCode: string;
  version: string;
  effectiveFrom: string;
  effectiveTo?: string;
  legalBasis: string[];
  calculate(input: PayrollCalculationInput): PayrollCalculation;
};
