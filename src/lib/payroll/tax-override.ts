/** Manual PAYE is used only with a documented reason. Otherwise country tax law applies. */
export function resolveManualPayeOverride(input: {
  amount?: number | null;
  reason?: string | null;
}): number | undefined {
  if (input.amount == null || !Number.isFinite(Number(input.amount))) return undefined;
  const amount = Number(input.amount);
  if (amount < 0) return undefined;
  if (!String(input.reason || "").trim()) return undefined;
  return amount;
}
