import assert from "node:assert/strict";
import test from "node:test";
import { parseFinanceIncomeType, remainingClientBalance, resolveClientUnitSalePrice, summarizeClientDeposits, agreedPriceFromCatchUp, allocateClientCash, isPropertyEarningIncomeType } from "./finance-income";

test("parses known income types and falls back to other", () => {
  assert.equal(parseFinanceIncomeType("CLIENT_DEPOSIT"), "CLIENT_DEPOSIT");
  assert.equal(parseFinanceIncomeType("shortlet_revenue"), "SHORTLET_REVENUE");
  assert.equal(parseFinanceIncomeType("unknown"), "OTHER");
});

test("catch-up sale price is already paid + paying now + leftover", () => {
  const sale = agreedPriceFromCatchUp({
    alreadyOnFile: 1_000_000,
    openingPaid: 4_000_000,
    payingNow: 500_000,
    remainingToPay: 8_000_000,
  });
  assert.equal(sale, 13_500_000);
  // Collections (already on file + opening + paying now) stay income; leftover is AR, not a write-off.
  assert.equal(remainingClientBalance({ contractValue: sale, collected: 5_500_000 }), 8_000_000);
});

test("remaining balance never goes negative", () => {
  assert.equal(remainingClientBalance({ contractValue: 50_000_000, collected: 12_500_000 }), 37_500_000);
  assert.equal(remainingClientBalance({ contractValue: 10_000_000, collected: 12_000_000 }), 0);
});

test("sale price follows a promo or waived amount instead of the list price", () => {
  const promo = resolveClientUnitSalePrice({
    listPrice: 50_000_000,
    dealValue: null,
    agreedPrice: 42_000_000,
  });
  assert.equal(promo.listPrice, 50_000_000);
  assert.equal(promo.salePrice, 42_000_000);
  assert.equal(promo.isDiscounted, true);
  assert.equal(remainingClientBalance({ contractValue: promo.salePrice, collected: 42_000_000 }), 0);

  const listOnly = resolveClientUnitSalePrice({ listPrice: 50_000_000, dealValue: null, agreedPrice: null });
  assert.equal(listOnly.salePrice, 50_000_000);
  assert.equal(listOnly.isDiscounted, false);

  const dealPrice = resolveClientUnitSalePrice({
    listPrice: 50_000_000,
    dealValue: 47_000_000,
    agreedPrice: null,
  });
  assert.equal(dealPrice.salePrice, 47_000_000);
  assert.equal(dealPrice.isDiscounted, true);

  const waived = resolveClientUnitSalePrice({
    listPrice: 50_000_000,
    dealValue: null,
    agreedPrice: 0,
  });
  assert.equal(waived.salePrice, 0);
  assert.equal(waived.isDiscounted, true);
  assert.equal(remainingClientBalance({ contractValue: waived.salePrice, collected: 0 }), 0);
});

test("summarizes client deposit rows for list and reports", () => {
  const totals = summarizeClientDeposits([
    { contractValue: 10_000_000, collected: 2_000_000, remaining: 8_000_000 },
    { contractValue: 5_000_000, collected: 5_000_000, remaining: 0 },
  ]);
  assert.equal(totals.contractValue, 15_000_000);
  assert.equal(totals.collected, 7_000_000);
  assert.equal(totals.remaining, 8_000_000);
  assert.equal(totals.earnings, 0);
});

test("short-let earnings stay off paid and remaining", () => {
  assert.equal(isPropertyEarningIncomeType("SHORTLET_REVENUE"), true);
  assert.equal(isPropertyEarningIncomeType("CLIENT_DEPOSIT"), false);

  const earning = allocateClientCash("SHORTLET_REVENUE", 493_000);
  assert.equal(earning.collected, 0);
  assert.equal(earning.earnings, 493_000);
  assert.equal(earning.isDeposit, false);

  const payment = allocateClientCash("CLIENT_DEPOSIT", 20_000_000);
  assert.equal(payment.collected, 20_000_000);
  assert.equal(payment.earnings, 0);
  assert.equal(payment.isDeposit, true);

  const remaining = remainingClientBalance({
    contractValue: 40_000_000,
    collected: payment.collected,
  });
  assert.equal(remaining, 20_000_000);

  const totals = summarizeClientDeposits([
    { contractValue: 40_000_000, collected: 20_000_000, remaining: 20_000_000, earnings: 0 },
    { contractValue: 0, collected: 0, remaining: 0, earnings: 493_000 },
  ]);
  assert.equal(totals.collected, 20_000_000);
  assert.equal(totals.earnings, 493_000);
  assert.equal(totals.remaining, 20_000_000);
});
