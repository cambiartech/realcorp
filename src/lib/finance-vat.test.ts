import assert from "node:assert/strict";
import test from "node:test";
import { calculateVatBreakdown, expensePnlAmount } from "./finance-vat";

test("exclusive VAT adds tax to the entered net amount", () => {
  assert.deepEqual(
    calculateVatBreakdown({ amount: 100_000, treatment: "EXCLUSIVE", rate: 7.5 }),
    { subtotal: 100_000, vatAmount: 7_500, grossAmount: 107_500, vatRate: 7.5 },
  );
});

test("inclusive VAT extracts tax from the entered gross amount", () => {
  assert.deepEqual(
    calculateVatBreakdown({ amount: 107_500, treatment: "INCLUSIVE", rate: 7.5 }),
    { subtotal: 100_000, vatAmount: 7_500, grossAmount: 107_500, vatRate: 7.5 },
  );
});

test("recoverable input VAT is excluded from P and L expense", () => {
  assert.equal(expensePnlAmount({ grossAmount: 107_500, subtotal: 100_000, vatRecoverable: true }), 100_000);
  assert.equal(expensePnlAmount({ grossAmount: 107_500, subtotal: 100_000, vatRecoverable: false }), 107_500);
});
