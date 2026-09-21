/** Sentinel for statutory fields when the employee opted out / not interested. */
export const STATUTORY_NIL = "NIL";

const NIL_ALIASES = new Set([
  "nil",
  "n/a",
  "na",
  "none",
  "n.a.",
  "not applicable",
  "notinterested",
  "not interested",
  "opted out",
  "opt-out",
  "optout",
  "-",
  "—",
]);

export function normalizeStatutoryValue(value?: string | null) {
  return (value || "").trim();
}

/** True when HR explicitly marked the field as not applicable. */
export function isStatutoryNil(value?: string | null) {
  const raw = normalizeStatutoryValue(value);
  if (!raw) return false;
  if (raw.toUpperCase() === STATUTORY_NIL) return true;
  return NIL_ALIASES.has(raw.toLowerCase());
}

/** True when a real identifier is on file (not blank, not NIL). */
export function hasStatutoryValue(value?: string | null) {
  const raw = normalizeStatutoryValue(value);
  return Boolean(raw) && !isStatutoryNil(raw);
}

/** Filled with a real value, or explicitly NIL. */
export function statutoryFieldSettled(value?: string | null) {
  return hasStatutoryValue(value) || isStatutoryNil(value);
}

/**
 * TIN / RSA / PFA for onboarding checklist.
 * Blank is allowed (optional). NIL or pension = Not applicable also counts as settled.
 * Never blocks the required onboarding % — this only drives the optional row’s checkmark.
 */
export function statutoryIdsSettled(input: {
  taxId?: string | null;
  rsaPin?: string | null;
  pensionAdministrator?: string | null;
  pensionEnabled?: boolean | string | null;
}) {
  const pensionOff =
    input.pensionEnabled === false ||
    input.pensionEnabled === "no" ||
    input.pensionEnabled === "NO";

  const tin = normalizeStatutoryValue(input.taxId);
  const rsa = normalizeStatutoryValue(input.rsaPin);
  const pfa = normalizeStatutoryValue(input.pensionAdministrator);

  const tinOk = !tin || statutoryFieldSettled(tin);
  const rsaOk = pensionOff || !rsa || statutoryFieldSettled(rsa);
  const pfaOk = pensionOff || !pfa || statutoryFieldSettled(pfa);

  return tinOk && rsaOk && pfaOk;
}
