/**
 * Payroll money helpers — integer kobo only for arithmetic.
 * Never use IEEE floats for balances, fees, or payouts.
 */

export type MoneyParseResult =
  | { ok: true; kobo: number; naira: string }
  | { ok: false; error: string };

const MAX_KOBO = 99_999_999_999_99; // ₦999,999,999,999.99

/** Parse a human Naira amount (string or number) into kobo. Rejects >2dp and negatives. */
export function parseNairaToKobo(input: string | number): MoneyParseResult {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return { ok: false, error: "Amount must be a finite number." };
    if (input < 0) return { ok: false, error: "Amount cannot be negative." };
    const rounded = Math.round(input * 100);
    if (Math.abs(input * 100 - rounded) > 1e-6) {
      return { ok: false, error: "Amount may have at most 2 decimal places." };
    }
    if (rounded > MAX_KOBO) return { ok: false, error: "Amount is too large." };
    return { ok: true, kobo: rounded, naira: koboToNairaString(rounded) };
  }

  const raw = String(input).trim().replace(/,/g, "");
  if (!raw) return { ok: false, error: "Amount is required." };
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    return { ok: false, error: "Amount must be a number with at most 2 decimal places (e.g. 250000.50)." };
  }
  const [whole, frac = ""] = raw.split(".");
  const kobo = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isSafeInteger(kobo) || kobo > MAX_KOBO) {
    return { ok: false, error: "Amount is too large." };
  }
  return { ok: true, kobo, naira: koboToNairaString(kobo) };
}

export function koboToNairaString(kobo: number): string {
  if (!Number.isSafeInteger(kobo) || kobo < 0) {
    throw new Error("kobo must be a non-negative safe integer");
  }
  const whole = Math.floor(kobo / 100);
  const frac = kobo % 100;
  return `${whole}.${String(frac).padStart(2, "0")}`;
}

export function decimalLikeToKobo(value: { toString(): string } | string | number): number {
  const parsed = parseNairaToKobo(typeof value === "number" ? value : value.toString());
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.kobo;
}

export type LedgerDirection = "CREDIT" | "DEBIT";

export function entryTypeDirection(
  entryType:
    | "FUNDING_CREDIT"
    | "PAYOUT_DEBIT"
    | "FEE_DEBIT"
    | "ADJUSTMENT_CREDIT"
    | "ADJUSTMENT_DEBIT"
    | "PAYOUT_REVERSAL",
): LedgerDirection {
  switch (entryType) {
    case "FUNDING_CREDIT":
    case "ADJUSTMENT_CREDIT":
    case "PAYOUT_REVERSAL":
      return "CREDIT";
    case "PAYOUT_DEBIT":
    case "FEE_DEBIT":
    case "ADJUSTMENT_DEBIT":
      return "DEBIT";
  }
}

/**
 * Apply one ledger movement. Returns next balance or an error if debit would go negative.
 * Pure — no DB. Callers must persist atomically.
 */
export function applyLedgerDelta(input: {
  balanceKobo: number;
  entryType: Parameters<typeof entryTypeDirection>[0];
  amountKobo: number;
}): { ok: true; balanceAfterKobo: number } | { ok: false; error: string } {
  if (!Number.isSafeInteger(input.balanceKobo) || input.balanceKobo < 0) {
    return { ok: false, error: "Current balance is invalid." };
  }
  if (!Number.isSafeInteger(input.amountKobo) || input.amountKobo <= 0) {
    return { ok: false, error: "Entry amount must be a positive amount." };
  }

  const direction = entryTypeDirection(input.entryType);
  if (direction === "CREDIT") {
    const next = input.balanceKobo + input.amountKobo;
    if (!Number.isSafeInteger(next) || next > MAX_KOBO) {
      return { ok: false, error: "Balance would exceed the maximum allowed." };
    }
    return { ok: true, balanceAfterKobo: next };
  }

  if (input.amountKobo > input.balanceKobo) {
    return {
      ok: false,
      error: `Insufficient Available balance. Need ₦${koboToNairaString(input.amountKobo)}, have ₦${koboToNairaString(input.balanceKobo)}.`,
    };
  }
  return { ok: true, balanceAfterKobo: input.balanceKobo - input.amountKobo };
}

export type FeeSchedule = {
  /** Flat fee per successful staff payout, in Naira (2dp). */
  feeFlatNaira: number;
  /** Percent of net pay in basis points (100 bps = 1%). */
  feePercentBps: number;
  /** Optional cap on the percent portion (Naira). Flat fee is always added. */
  feeCapNaira?: number;
};

export function parseFeeSchedule(raw: unknown): FeeSchedule {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const flat = typeof obj.feeFlatNaira === "number" ? obj.feeFlatNaira : 0;
  const bps = typeof obj.feePercentBps === "number" ? obj.feePercentBps : 0;
  const cap = typeof obj.feeCapNaira === "number" ? obj.feeCapNaira : undefined;
  return {
    feeFlatNaira: flat >= 0 ? flat : 0,
    feePercentBps: bps >= 0 ? bps : 0,
    feeCapNaira: cap !== undefined && cap >= 0 ? cap : undefined,
  };
}

/** Fee for one successful payout of `netPayKobo`. Integer kobo; round half-up on percent. */
export function calculatePayoutFeeKobo(netPayKobo: number, schedule: FeeSchedule): number {
  if (!Number.isSafeInteger(netPayKobo) || netPayKobo < 0) {
    throw new Error("netPayKobo must be a non-negative safe integer");
  }
  const flat = parseNairaToKobo(schedule.feeFlatNaira);
  if (!flat.ok) throw new Error(flat.error);
  const percentKobo = Math.round((netPayKobo * schedule.feePercentBps) / 10_000);
  let percentPortion = percentKobo;
  if (schedule.feeCapNaira !== undefined) {
    const cap = parseNairaToKobo(schedule.feeCapNaira);
    if (!cap.ok) throw new Error(cap.error);
    percentPortion = Math.min(percentPortion, cap.kobo);
  }
  return flat.kobo + percentPortion;
}
