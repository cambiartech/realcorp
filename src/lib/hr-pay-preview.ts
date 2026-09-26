import { calculatePayroll, PayrollConfigurationError } from "@/lib/payroll/engine";
import type { PayrollCalculation } from "@/lib/payroll/types";
import { resolveManualPayeOverride } from "@/lib/payroll/tax-override";

/** Current monthly package on the employee record. One-off bonuses stay on the payslip. */
export type MonthlyPayInput = {
  grossMonthly: string;
  payrollCountryCode: string;
  basicPercent: string;
  housingPercent: string;
  transportPercent: string;
  otherPercent: string;
  pensionEnabled: string;
  employeePensionRate: string;
  employerPensionRate: string;
  nhfMonthly: string;
  nhiaMonthly: string;
  annualRent: string;
  annualLifeInsurance: string;
  annualMortgageInterest: string;
  otherPreTaxMonthly: string;
  otherPostTaxMonthly: string;
  payeeTaxMonthly: string;
  taxOverrideReason: string;
};

function amount(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function percent(value: string, fallback: number) {
  if (!value.trim()) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function previewMonthlyPay(
  input: MonthlyPayInput,
  now = new Date(),
): PayrollCalculation | null {
  const gross = amount(input.grossMonthly);
  if (gross <= 0) return null;
  const taxOverrideMonthly = resolveManualPayeOverride({
    amount: input.payeeTaxMonthly.trim() ? amount(input.payeeTaxMonthly) : null,
    reason: input.taxOverrideReason,
  });
  try {
    return calculatePayroll({
      countryCode: input.payrollCountryCode || "NG",
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      grossMonthly: gross,
      basicPercent: percent(input.basicPercent, 30),
      housingPercent: percent(input.housingPercent, 20),
      transportPercent: percent(input.transportPercent, 15),
      otherPercent: percent(input.otherPercent, 35),
      pensionEnabled: input.pensionEnabled !== "no",
      employeePensionRate: percent(input.employeePensionRate, 8),
      employerPensionRate: percent(input.employerPensionRate, 10),
      nhfMonthly: amount(input.nhfMonthly),
      nhiaMonthly: amount(input.nhiaMonthly),
      annualRent: amount(input.annualRent),
      annualLifeInsurance: amount(input.annualLifeInsurance),
      annualMortgageInterest: amount(input.annualMortgageInterest),
      otherPreTaxMonthly: amount(input.otherPreTaxMonthly),
      otherPostTaxMonthly: amount(input.otherPostTaxMonthly),
      taxOverrideMonthly,
      taxOverrideReason: input.taxOverrideReason,
    });
  } catch (error) {
    if (error instanceof PayrollConfigurationError) return null;
    throw error;
  }
}
