import { koboToNairaString } from "./money";

/**
 * Published Paystack NGN transfer fee bands (kobo).
 * Stamp duty ₦50 applies on transfers ≥ ₦10,000 from 18 Feb 2026.
 * @see https://support.paystack.com/en/articles/2132866
 */
export function estimatePaystackTransferFeeKobo(amountKobo: number, now = new Date()): number {
  if (!Number.isSafeInteger(amountKobo) || amountKobo < 0) {
    throw new Error("amountKobo must be a non-negative safe integer");
  }
  const naira = amountKobo / 100;
  let feeKobo = 5000; // ₦50
  if (naira <= 5000) feeKobo = 1000;
  else if (naira <= 50000) feeKobo = 2500;

  const stampDutyStart = Date.UTC(2026, 1, 18); // 18 Feb 2026
  if (now.getTime() >= stampDutyStart && naira >= 10000) {
    feeKobo += 5000; // ₦50 stamp duty
  }
  return feeKobo;
}

export function estimatePaystackTransferFeeNaira(amountKobo: number, now = new Date()): string {
  return koboToNairaString(estimatePaystackTransferFeeKobo(amountKobo, now));
}
