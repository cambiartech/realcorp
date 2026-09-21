import assert from "node:assert/strict";
import test from "node:test";
import { estimatePaystackTransferFeeKobo } from "./provider-fees";

test("Paystack fee bands before stamp duty era", () => {
  const before = new Date("2026-02-01T00:00:00Z");
  assert.equal(estimatePaystackTransferFeeKobo(400_000, before), 1000); // ₦4,000 → ₦10
  assert.equal(estimatePaystackTransferFeeKobo(1_000_000, before), 2500); // ₦10,000 → ₦25
  assert.equal(estimatePaystackTransferFeeKobo(10_000_000, before), 5000); // ₦100,000 → ₦50
});

test("Paystack stamp duty from 18 Feb 2026 on ≥ ₦10k", () => {
  const after = new Date("2026-02-18T00:00:00Z");
  assert.equal(estimatePaystackTransferFeeKobo(400_000, after), 1000); // under 10k — no stamp
  assert.equal(estimatePaystackTransferFeeKobo(1_000_000, after), 2500 + 5000); // ₦25 + ₦50
  assert.equal(estimatePaystackTransferFeeKobo(10_000_000, after), 5000 + 5000);
});
