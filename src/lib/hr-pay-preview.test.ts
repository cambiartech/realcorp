import assert from "node:assert/strict";
import test from "node:test";
import { previewMonthlyPay } from "./hr-pay-preview";

const base: Parameters<typeof previewMonthlyPay>[0] = {
  grossMonthly: "200000",
  payrollCountryCode: "NG",
  basicPercent: "30",
  housingPercent: "20",
  transportPercent: "15",
  otherPercent: "35",
  pensionEnabled: "yes",
  employeePensionRate: "8",
  employerPensionRate: "10",
  nhfMonthly: "",
  nhiaMonthly: "",
  annualRent: "",
  annualLifeInsurance: "",
  annualMortgageInterest: "",
  otherPreTaxMonthly: "",
  otherPostTaxMonthly: "",
  payeeTaxMonthly: "",
  taxOverrideReason: "",
};

test("employee pay preview matches Nigeria 2026 PAYE for a ₦200,000 gross", () => {
  const pay = previewMonthlyPay(base, new Date("2026-08-01"));
  assert.ok(pay);
  assert.equal(pay.earnings.find((line) => line.code === "BASIC")?.amount, 60_000);
  assert.equal(pay.earnings.find((line) => line.code === "HOUSING")?.amount, 40_000);
  assert.equal(pay.earnings.find((line) => line.code === "TRANSPORT")?.amount, 30_000);
  assert.equal(pay.earnings.find((line) => line.code === "OTHER")?.amount, 70_000);
  assert.equal(pay.employeePension, 10_400);
  assert.equal(pay.tax, 18_440);
  assert.equal(pay.netPay, 171_160);
  assert.equal(pay.deductions.find((line) => line.code === "PAYE")?.amount, 18_440);
});

test("a documented PAYE override replaces the tax-law amount on the employee preview", () => {
  const pay = previewMonthlyPay(
    { ...base, payeeTaxMonthly: "5000", taxOverrideReason: "Tax authority directive" },
    new Date("2026-08-01"),
  );
  assert.ok(pay);
  assert.equal(pay.tax, 5_000);
  assert.equal(pay.netPay, 184_600);
});

test("an override without a reason stays on country tax law", () => {
  const pay = previewMonthlyPay(
    { ...base, payeeTaxMonthly: "5000", taxOverrideReason: "" },
    new Date("2026-08-01"),
  );
  assert.equal(pay?.tax, 18_440);
});
