import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRemittanceSchedules, remittanceGrandTotal } from "./hr-remittances";
import type { PayslipCalculation } from "./hr-payslip";

function calc(partial: Partial<PayslipCalculation>): PayslipCalculation {
  return {
    grossPay: 200_000,
    earnings: [],
    deductions: [],
    payeeTax: 0,
    pensionDeduction: 0,
    otherDeductions: 0,
    netPay: 169_640,
    ...partial,
  };
}

test("remittance schedules split PAYE, pension, NHF, and NSITF", () => {
  const schedules = buildRemittanceSchedules([
    {
      employeeName: "Busayo Ewedemi",
      department: "HR",
      taxId: "TIN-1",
      rsaPin: "PEN100",
      pensionAdministrator: "ARM Pension Managers",
      nhfMembershipNumber: "NHF-9",
      calc: calc({
        payeeTax: 19_960,
        pensionDeduction: 10_400,
        deductions: [
          { code: "PAYE", label: "PAYE", amount: 19_960, timing: "TAX" },
          { code: "PENSION_EMPLOYEE", label: "Pension", amount: 10_400, timing: "PRE_TAX" },
          { code: "NHF", label: "NHF", amount: 2_500, timing: "PRE_TAX" },
        ],
        employerContributions: [
          { code: "PENSION_EMPLOYER", label: "Employer pension", amount: 13_000, paidBy: "EMPLOYER" },
          { code: "NSITF", label: "NSITF", amount: 2_000, paidBy: "EMPLOYER" },
        ],
      }),
    },
  ]);

  assert.equal(schedules.paye.total, 19_960);
  assert.equal(schedules.pension.employeeTotal, 10_400);
  assert.equal(schedules.pension.employerTotal, 13_000);
  assert.equal(schedules.pension.total, 23_400);
  assert.equal(schedules.pension.rows[0]?.pensionAdministrator, "ARM Pension Managers");
  assert.equal(schedules.nhf.total, 2_500);
  assert.equal(schedules.nsitf.total, 2_000);
  assert.equal(remittanceGrandTotal(schedules), 47_860);
});

test("remittance flags missing RSA PIN and TIN", () => {
  const schedules = buildRemittanceSchedules([
    {
      employeeName: "No IDs",
      department: "",
      taxId: "",
      rsaPin: "",
      pensionAdministrator: "",
      nhfMembershipNumber: "",
      calc: calc({
        payeeTax: 1_000,
        pensionDeduction: 800,
        employerContributions: [
          { code: "PENSION_EMPLOYER", label: "Employer pension", amount: 1_000, paidBy: "EMPLOYER" },
        ],
      }),
    },
  ]);

  assert.equal(schedules.paye.missingIdentity, 1);
  assert.equal(schedules.pension.missingIdentity, 1);
});
