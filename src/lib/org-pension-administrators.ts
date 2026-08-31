/** Optional starters an org can click to add. Not applied until they save them for that org. */
export const SUGGESTED_NIGERIA_PENSION_ADMINISTRATORS = [
  "Stanbic IBTC Pension Managers Limited",
  "Guaranty Trust Pension Managers Limited",
  "AccessARM Pension Limited",
  "Leadway Pensure PFA Limited",
] as const;

export function normalizePensionAdministratorName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function parsePensionAdministrators(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const name = normalizePensionAdministratorName(item);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

export function pensionAdministratorSelectOptions(
  orgList: string[],
  currentValue?: string | null,
): string[] {
  const names = parsePensionAdministrators(orgList);
  const current = normalizePensionAdministratorName(currentValue ?? "");
  if (current && !names.some((name) => name.toLowerCase() === current.toLowerCase())) {
    return [current, ...names];
  }
  return names;
}
