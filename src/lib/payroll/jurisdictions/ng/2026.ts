import type {
  PayrollCalculation,
  PayrollCalculationInput,
  PayrollDeductionLine,
  PayrollRuleSet,
} from "../../types";

const MINIMUM_WAGE_MONTHLY = 70_000;
const RENT_RELIEF_CAP_ANNUAL = 500_000;
const LEGAL_BASIS = [
  "Nigeria Tax Act 2025 (effective 1 January 2026)",
  "Pension Reform Act 2014",
  "Employee Compensation Act 2010",
];

/** Progressive NTA 2026 bands. The first ₦800,000 of chargeable income is untaxed. */
export const NIGERIA_TAX_BANDS = [
  { from: 0, to: 800_000, rate: 0, label: "First ₦800,000 (untaxed)" },
  { from: 800_000, to: 3_000_000, rate: 0.15, label: "₦800,001 – ₦3,000,000" },
  { from: 3_000_000, to: 12_000_000, rate: 0.18, label: "₦3,000,001 – ₦12,000,000" },
  { from: 12_000_000, to: 25_000_000, rate: 0.21, label: "₦12,000,001 – ₦25,000,000" },
  { from: 25_000_000, to: 50_000_000, rate: 0.23, label: "₦25,000,001 – ₦50,000,000" },
  { from: 50_000_000, to: null, rate: 0.25, label: "Above ₦50,000,000" },
] as const;

export type NigeriaAppliedTaxBand = {
  label: string;
  from: number;
  to: number | null;
  rate: number;
  incomeInBand: number;
  taxInBand: number;
};

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function nonNegative(value: number | undefined) {
  return Math.max(0, Number.isFinite(value) ? Number(value) : 0);
}

export function explainNigeriaAnnualTax(chargeableIncome: number): {
  tax: number;
  bands: NigeriaAppliedTaxBand[];
} {
  let remaining = nonNegative(chargeableIncome);
  let tax = 0;
  const bands: NigeriaAppliedTaxBand[] = [];

  for (const band of NIGERIA_TAX_BANDS) {
    if (remaining <= 0) break;
    const width = band.to == null ? Number.POSITIVE_INFINITY : band.to - band.from;
    const incomeInBand = Math.min(remaining, width);
    const taxInBand = round2(incomeInBand * band.rate);
    bands.push({
      label: band.label,
      from: band.from,
      to: band.to,
      rate: band.rate,
      incomeInBand: round2(incomeInBand),
      taxInBand,
    });
    tax += taxInBand;
    remaining -= incomeInBand;
  }

  return { tax: round2(tax), bands };
}

export function calculateNigeriaAnnualTax(chargeableIncome: number) {
  return explainNigeriaAnnualTax(chargeableIncome).tax;
}

function earningLines(input: PayrollCalculationInput) {
  const gross = nonNegative(input.grossMonthly);
  const percentages = [
    { code: "BASIC", label: "Basic salary", percent: input.basicPercent ?? 30 },
    { code: "HOUSING", label: "Housing allowance", percent: input.housingPercent ?? 20 },
    { code: "TRANSPORT", label: "Transport allowance", percent: input.transportPercent ?? 15 },
    { code: "OTHER", label: "Other earnings", percent: input.otherPercent ?? 35 },
  ];
  const totalPercent = percentages.reduce((sum, line) => sum + nonNegative(line.percent), 0);
  const divisor = totalPercent > 0 ? totalPercent : 100;

  return percentages.map((line) => ({
    ...line,
    percent: round2((nonNegative(line.percent) / divisor) * 100),
    amount: round2(gross * (nonNegative(line.percent) / divisor)),
  }));
}

function calculateNigeriaPayroll(input: PayrollCalculationInput): PayrollCalculation {
  const recurringGross = round2(nonNegative(input.grossMonthly));
  const recurringEarnings = earningLines(input);
  const variableEarnings = (input.variableEarnings ?? []).map((line) => ({
    code: line.code,
    label: line.label,
    percent: null,
    amount: round2(nonNegative(line.amount)),
    taxable: line.taxable,
    pensionable: line.pensionable,
  }));
  const grossPay = round2(
    recurringGross + variableEarnings.reduce((sum, line) => sum + line.amount, 0),
  );
  const taxableGross = round2(
    recurringGross +
      variableEarnings.filter((line) => line.taxable).reduce((sum, line) => sum + line.amount, 0),
  );
  const earnings: PayrollCalculation["earnings"] = [
    ...recurringEarnings,
    ...variableEarnings.map(({ code, label, percent, amount }) => ({ code, label, percent, amount })),
  ];
  const basicHousingTransport = recurringEarnings
    .filter((line) => line.code !== "OTHER")
    .reduce((sum, line) => sum + line.amount, 0);
  const pensionableVariableEarnings = variableEarnings
    .filter((line) => line.pensionable)
    .reduce((sum, line) => sum + line.amount, 0);
  const pensionBasis = round2(basicHousingTransport + pensionableVariableEarnings);

  const pensionEnabled = input.pensionEnabled ?? true;
  const employeePensionRate = pensionEnabled ? nonNegative(input.employeePensionRate ?? 8) : 0;
  const employerPensionRate = pensionEnabled ? nonNegative(input.employerPensionRate ?? 10) : 0;
  const employeePension = round2(pensionBasis * (employeePensionRate / 100));
  const employerPension = round2(pensionBasis * (employerPensionRate / 100));
  const nhf = round2(nonNegative(input.nhfMonthly));
  const nhia = round2(nonNegative(input.nhiaMonthly));
  const lifeInsuranceMonthly = round2(nonNegative(input.annualLifeInsurance) / 12);
  const mortgageInterestMonthly = round2(nonNegative(input.annualMortgageInterest) / 12);
  const rentReliefAnnual = Math.min(
    round2(nonNegative(input.annualRent) * 0.2),
    RENT_RELIEF_CAP_ANNUAL,
  );
  const rentReliefMonthly = round2(rentReliefAnnual / 12);
  const otherPreTax = round2(nonNegative(input.otherPreTaxMonthly));
  const otherPostTax = round2(nonNegative(input.otherPostTaxMonthly));
  const variableDeductions = (input.variableDeductions ?? []).map((line) => ({
    code: line.code,
    label: line.label,
    amount: round2(nonNegative(line.amount)),
    preTax: line.preTax,
  }));
  const variablePreTax = variableDeductions
    .filter((line) => line.preTax)
    .reduce((sum, line) => sum + line.amount, 0);
  const variableDeductionTotal = variableDeductions.reduce((sum, line) => sum + line.amount, 0);

  const eligibleDeductions = round2(
    employeePension +
      nhf +
      nhia +
      lifeInsuranceMonthly +
      mortgageInterestMonthly +
      rentReliefMonthly +
      otherPreTax +
      variablePreTax,
  );
  const chargeableIncome = round2(Math.max(0, taxableGross - eligibleDeductions));
  const priorChargeable = nonNegative(input.priorYtd?.chargeableIncome);
  const priorTax = nonNegative(input.priorYtd?.taxWithheld);
  const elapsedMonths = Math.max(1, Math.min(12, (input.priorYtd?.monthsProcessed ?? 0) + 1));
  const cumulativeChargeable = round2(priorChargeable + chargeableIncome);
  const projectedAnnualChargeableIncome = round2((cumulativeChargeable / elapsedMonths) * 12);
  const annualTax =
    taxableGross <= MINIMUM_WAGE_MONTHLY
      ? { tax: 0, bands: [] as NigeriaAppliedTaxBand[] }
      : explainNigeriaAnnualTax(projectedAnnualChargeableIncome);
  const projectedAnnualTax = annualTax.tax;
  const targetCumulativeTax = round2((projectedAnnualTax / 12) * elapsedMonths);
  const calculatedTax = round2(targetCumulativeTax - priorTax);
  const taxOverrideApplied = input.taxOverrideMonthly !== undefined;
  const tax = taxOverrideApplied
    ? round2(nonNegative(input.taxOverrideMonthly))
    : calculatedTax;

  const deductionLines: PayrollDeductionLine[] = [
    { code: "PAYE", label: "PAYE income tax", amount: tax, timing: "TAX" },
    { code: "PENSION_EMPLOYEE", label: "Employee pension", amount: employeePension, timing: "PRE_TAX" },
    { code: "NHF", label: "National Housing Fund", amount: nhf, timing: "PRE_TAX" },
    { code: "NHIA", label: "Health insurance", amount: nhia, timing: "PRE_TAX" },
    { code: "OTHER_PRE_TAX", label: "Other pre-tax deductions", amount: otherPreTax, timing: "PRE_TAX" },
    { code: "OTHER_POST_TAX", label: "Other deductions", amount: otherPostTax, timing: "POST_TAX" },
    ...variableDeductions.map((line) => ({
      code: line.code,
      label: line.label,
      amount: line.amount,
      timing: line.preTax ? ("PRE_TAX" as const) : ("POST_TAX" as const),
    })),
  ];
  const deductions = deductionLines.filter((line) => line.amount !== 0);

  const configuredEmployerContributions = input.employerStatutoryContributions ?? [];
  const defaultNsitf: NonNullable<PayrollCalculationInput["employerStatutoryContributions"]> =
    configuredEmployerContributions.some((line) => line.code === "NSITF")
    ? []
    : [{ code: "NSITF", label: "Employee Compensation contribution", rate: 1 }];
  const employerContributions = [
    {
      code: "PENSION_EMPLOYER",
      label: "Employer pension",
      amount: employerPension,
      paidBy: "EMPLOYER" as const,
    },
    ...[...defaultNsitf, ...configuredEmployerContributions].map((line) => ({
      code: line.code,
      label: line.label,
      amount: round2(nonNegative(line.fixedAmount) + grossPay * (nonNegative(line.rate) / 100)),
      paidBy: "EMPLOYER" as const,
    })),
  ].filter((line) => line.amount !== 0);

  const employerContributionTotal = employerContributions.reduce((sum, line) => sum + line.amount, 0);
  const otherDeductions = round2(
    nhf + nhia + otherPreTax + otherPostTax + variableDeductionTotal,
  );
  const netPay = round2(grossPay - tax - employeePension - otherDeductions);

  return {
    jurisdictionCode: "NG",
    ruleVersion: "NG-NTA-2026.1",
    currency: "NGN",
    grossPay,
    earnings,
    deductions,
    employerContributions,
    tax,
    employeePension,
    employerPension,
    otherDeductions,
    eligibleDeductions,
    chargeableIncome,
    projectedAnnualChargeableIncome,
    projectedAnnualTax,
    netPay,
    employerCost: round2(grossPay + employerContributionTotal),
    taxOverrideApplied,
    taxOverrideReason: taxOverrideApplied ? input.taxOverrideReason?.trim() || "Manual override" : null,
    calculationBreakdown: {
      method: "cumulative-annualised",
      legalBasis: LEGAL_BASIS,
      taxBands: NIGERIA_TAX_BANDS.map((band) => ({
        from: band.from,
        to: band.to,
        rate: band.rate,
        label: band.label,
      })),
      appliedTaxBands: annualTax.bands,
      projectedAnnualChargeableIncome,
      projectedAnnualTax,
      minimumWageMonthly: MINIMUM_WAGE_MONTHLY,
      recurringGross,
      variableEarnings: variableEarnings.map(({ code, amount, taxable, pensionable }) => ({
        code,
        amount,
        taxable,
        pensionable,
      })),
      variableDeductions,
      taxableGross,
      pensionBasis,
      employeePensionRate,
      employerPensionRate,
      rentReliefAnnual,
      priorYtd: {
        chargeableIncome: priorChargeable,
        taxWithheld: priorTax,
        monthsProcessed: input.priorYtd?.monthsProcessed ?? 0,
      },
      targetCumulativeTax,
    },
  };
}

export const nigeria2026RuleSet: PayrollRuleSet = {
  countryCode: "NG",
  version: "NG-NTA-2026.1",
  effectiveFrom: "2026-01-01",
  legalBasis: LEGAL_BASIS,
  calculate: calculateNigeriaPayroll,
};
