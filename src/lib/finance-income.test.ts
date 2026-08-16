import assert from "node:assert/strict";
import test from "node:test";
import { parseFinanceIncomeType, remainingClientBalance } from "./finance-income";

test("parses known income types and falls back to other", () => {
  assert.equal(parseFinanceIncomeType("CLIENT_DEPOSIT"), "CLIENT_DEPOSIT");
  assert.equal(parseFinanceIncomeType("shortlet_revenue"), "SHORTLET_REVENUE");
  assert.equal(parseFinanceIncomeType("unknown"), "OTHER");
});

test("remaining client balance never goes below zero", () => {
  assert.equal(remainingClientBalance({ contractValue: 50_000_000, collected: 12_500_000 }), 37_500_000);
  assert.equal(remainingClientBalance({ contractValue: 10_000_000, collected: 12_000_000 }), 0);
});
