import { nigeria2026RuleSet } from "./jurisdictions/ng/2026";
import type { PayrollCalculation, PayrollCalculationInput, PayrollRuleSet } from "./types";

const RULE_SETS: PayrollRuleSet[] = [nigeria2026RuleSet];

export class PayrollConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayrollConfigurationError";
  }
}

function normaliseCountryCode(countryCode: string) {
  return countryCode.trim().toUpperCase();
}

export function resolvePayrollRuleSet(countryCode: string, year: number, month: number) {
  const country = normaliseCountryCode(countryCode);
  const calculationDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const candidates = RULE_SETS.filter(
    (rule) =>
      rule.countryCode === country &&
      rule.effectiveFrom <= calculationDate &&
      (!rule.effectiveTo || rule.effectiveTo >= calculationDate),
  ).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));

  const rule = candidates[0];
  if (!rule) {
    throw new PayrollConfigurationError(
      `Payroll rules are not configured for ${country || "this employee"} in ${year}. Add a reviewed jurisdiction rule before generating payroll.`,
    );
  }
  return rule;
}

export function calculatePayroll(input: PayrollCalculationInput): PayrollCalculation {
  if (!Number.isInteger(input.year) || input.month < 1 || input.month > 12) {
    throw new PayrollConfigurationError("Payroll period must contain a valid year and month.");
  }
  if (!Number.isFinite(input.grossMonthly) || input.grossMonthly < 0) {
    throw new PayrollConfigurationError("Gross monthly pay must be a non-negative number.");
  }
  const earningPercentages = [
    input.basicPercent ?? 30,
    input.housingPercent ?? 20,
    input.transportPercent ?? 15,
    input.otherPercent ?? 35,
  ];
  if (
    earningPercentages.some((value) => !Number.isFinite(value) || value < 0 || value > 100) ||
    Math.abs(earningPercentages.reduce((sum, value) => sum + value, 0) - 100) > 0.01
  ) {
    throw new PayrollConfigurationError("Basic, housing, transport, and other earnings must total 100%.");
  }
  const variableAmounts = [
    ...(input.variableEarnings ?? []).map((line) => line.amount),
    ...(input.variableDeductions ?? []).map((line) => line.amount),
  ];
  if (variableAmounts.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new PayrollConfigurationError("Monthly adjustment amounts must be greater than zero.");
  }

  const result = resolvePayrollRuleSet(input.countryCode, input.year, input.month).calculate(input);
  const criticalAmounts = [
    result.grossPay,
    result.tax,
    result.employeePension,
    result.otherDeductions,
    result.netPay,
    result.employerCost,
  ];
  if (criticalAmounts.some((value) => !Number.isFinite(value))) {
    throw new PayrollConfigurationError("Payroll produced an invalid amount. Review this employee's settings.");
  }
  if (result.netPay < 0) {
    throw new PayrollConfigurationError("Deductions exceed gross pay. Review the employee before generating payroll.");
  }
  return result;
}

export type {
  PayrollCalculation,
  PayrollCalculationInput,
  PayrollContributionLine,
  PayrollDeductionLine,
  PayrollEarningLine,
  PayrollPriorYtd,
} from "./types";
