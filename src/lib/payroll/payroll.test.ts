import assert from "node:assert/strict";
import test from "node:test";
import { calculatePayroll, PayrollConfigurationError } from "./engine";
import { calculateNigeriaAnnualTax } from "./jurisdictions/ng/2026";

test("Nigeria 2026 PAYE bands calculate exact boundary tax", () => {
  assert.equal(calculateNigeriaAnnualTax(800_000), 0);
  assert.equal(calculateNigeriaAnnualTax(3_000_000), 330_000);
  assert.equal(calculateNigeriaAnnualTax(12_000_000), 1_950_000);
  assert.equal(calculateNigeriaAnnualTax(25_000_000), 4_680_000);
  assert.equal(calculateNigeriaAnnualTax(50_000_000), 10_430_000);
  assert.equal(calculateNigeriaAnnualTax(60_000_000), 12_930_000);
});

test("Nigeria payroll applies pension, PAYE, employer pension, and NSITF", () => {
  const result = calculatePayroll({
    countryCode: "NG",
    year: 2026,
    month: 1,
    grossMonthly: 5_000_000,
  });

  assert.equal(result.ruleVersion, "NG-NTA-2026.1");
  assert.equal(result.employeePension, 260_000);
  assert.equal(result.employerPension, 325_000);
  assert.equal(result.chargeableIncome, 4_740_000);
  assert.equal(result.projectedAnnualTax, 12_150_000);
  assert.equal(result.tax, 1_012_500);
  assert.equal(result.netPay, 3_727_500);
  assert.equal(result.employerCost, 5_375_000);
});

test("minimum-wage employees are exempt from PAYE", () => {
  const result = calculatePayroll({
    countryCode: "ng",
    year: 2026,
    month: 8,
    grossMonthly: 70_000,
  });
  assert.equal(result.tax, 0);
});

test("verified reliefs reduce chargeable income and rent relief is capped", () => {
  const result = calculatePayroll({
    countryCode: "NG",
    year: 2026,
    month: 1,
    grossMonthly: 1_000_000,
    annualRent: 6_000_000,
    annualLifeInsurance: 120_000,
  });

  assert.equal(result.calculationBreakdown.rentReliefAnnual, 500_000);
  assert.equal(result.chargeableIncome, 896_333.33);
});

test("cumulative annualisation true-ups variable earnings", () => {
  const january = calculatePayroll({
    countryCode: "NG",
    year: 2026,
    month: 1,
    grossMonthly: 1_000_000,
  });
  const february = calculatePayroll({
    countryCode: "NG",
    year: 2026,
    month: 2,
    grossMonthly: 2_000_000,
    priorYtd: {
      chargeableIncome: january.chargeableIncome,
      taxWithheld: january.tax,
      monthsProcessed: 1,
    },
  });

  assert.equal(february.projectedAnnualChargeableIncome, 17_064_000);
  assert.equal(february.tax, 349_100);
});

test("manual tax overrides remain explicit in the calculation snapshot", () => {
  const result = calculatePayroll({
    countryCode: "NG",
    year: 2026,
    month: 1,
    grossMonthly: 1_000_000,
    taxOverrideMonthly: 50_000,
    taxOverrideReason: "Tax authority directive",
  });
  assert.equal(result.tax, 50_000);
  assert.equal(result.taxOverrideApplied, true);
  assert.equal(result.taxOverrideReason, "Tax authority directive");
});

test("unsupported jurisdictions fail closed", () => {
  assert.throws(
    () =>
      calculatePayroll({
        countryCode: "US",
        year: 2026,
        month: 1,
        grossMonthly: 1_000,
      }),
    PayrollConfigurationError,
  );
});

test("invalid earning allocations fail before payroll is persisted", () => {
  assert.throws(
    () =>
      calculatePayroll({
        countryCode: "NG",
        year: 2026,
        month: 1,
        grossMonthly: 1_000_000,
        basicPercent: 50,
        housingPercent: 20,
        transportPercent: 15,
        otherPercent: 35,
      }),
    /must total 100%/,
  );
});

test("monthly bonuses and deductions do not change contractual gross", () => {
  const result = calculatePayroll({
    countryCode: "NG",
    year: 2026,
    month: 1,
    grossMonthly: 1_000_000,
    variableEarnings: [
      { code: "BONUS", label: "Performance bonus", amount: 100_000, taxable: true, pensionable: true },
      { code: "REIMBURSEMENT", label: "Travel reimbursement", amount: 50_000, taxable: false, pensionable: false },
    ],
    variableDeductions: [
      { code: "LOAN", label: "Loan repayment", amount: 25_000, preTax: false },
    ],
  });

  assert.equal(result.grossPay, 1_150_000);
  assert.equal(result.employeePension, 60_000);
  assert.equal(result.tax, 170_900);
  assert.equal(result.otherDeductions, 25_000);
  assert.equal(result.netPay, 894_100);
  assert.equal(result.calculationBreakdown.recurringGross, 1_000_000);
});
