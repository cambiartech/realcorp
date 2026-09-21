import assert from "node:assert/strict";
import test from "node:test";
import {
  applyLedgerDelta,
  calculatePayoutFeeKobo,
  koboToNairaString,
  parseFeeSchedule,
  parseNairaToKobo,
} from "./money";

test("parseNairaToKobo accepts clean 2dp strings and rejects junk", () => {
  assert.deepEqual(parseNairaToKobo("250000.50"), {
    ok: true,
    kobo: 25_000_050,
    naira: "250000.50",
  });
  assert.deepEqual(parseNairaToKobo("1,000"), { ok: true, kobo: 100_000, naira: "1000.00" });
  assert.equal(parseNairaToKobo("-1").ok, false);
  assert.equal(parseNairaToKobo("10.999").ok, false);
  assert.equal(parseNairaToKobo("abc").ok, false);
  assert.equal(parseNairaToKobo("").ok, false);
});

test("koboToNairaString always emits 2 decimal places", () => {
  assert.equal(koboToNairaString(0), "0.00");
  assert.equal(koboToNairaString(1), "0.01");
  assert.equal(koboToNairaString(100), "1.00");
  assert.equal(koboToNairaString(171_160_00), "171160.00");
});

test("credits increase balance; debits never go negative", () => {
  const credit = applyLedgerDelta({
    balanceKobo: 100_000,
    entryType: "FUNDING_CREDIT",
    amountKobo: 50_000,
  });
  assert.deepEqual(credit, { ok: true, balanceAfterKobo: 150_000 });

  const okDebit = applyLedgerDelta({
    balanceKobo: 150_000,
    entryType: "PAYOUT_DEBIT",
    amountKobo: 150_000,
  });
  assert.deepEqual(okDebit, { ok: true, balanceAfterKobo: 0 });

  const short = applyLedgerDelta({
    balanceKobo: 10_000,
    entryType: "FEE_DEBIT",
    amountKobo: 10_001,
  });
  assert.equal(short.ok, false);

  const badAmount = applyLedgerDelta({
    balanceKobo: 10_000,
    entryType: "FUNDING_CREDIT",
    amountKobo: 0,
  });
  assert.equal(badAmount.ok, false);
});

test("PAYOUT_REVERSAL is a credit", () => {
  const rev = applyLedgerDelta({
    balanceKobo: 0,
    entryType: "PAYOUT_REVERSAL",
    amountKobo: 5_000,
  });
  assert.deepEqual(rev, { ok: true, balanceAfterKobo: 5_000 });
});

test("fee schedule: flat + percent with optional cap on percent portion", () => {
  const schedule = parseFeeSchedule({ feeFlatNaira: 100, feePercentBps: 50, feeCapNaira: 5_000 });
  // 0.5% of ₦1,000,000 = ₦5,000 + flat ₦100 = ₦5,100
  assert.equal(calculatePayoutFeeKobo(100_000_000, schedule), 510_000);
  // 0.5% of ₦2,000,000 would be ₦10,000 but cap keeps percent at ₦5,000 → ₦5,100
  assert.equal(calculatePayoutFeeKobo(200_000_000, schedule), 510_000);
  // small net: 0.5% of ₦100,000 = ₦500 + ₦100 = ₦600
  assert.equal(calculatePayoutFeeKobo(10_000_000, schedule), 60_000);
});

test("default fee schedule is zero when settings missing", () => {
  assert.deepEqual(parseFeeSchedule(null), {
    feeFlatNaira: 0,
    feePercentBps: 0,
    feeCapNaira: undefined,
  });
  assert.equal(calculatePayoutFeeKobo(1_000_000, parseFeeSchedule({})), 0);
});
