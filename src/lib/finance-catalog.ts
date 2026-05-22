/**
 * Normalize TenantSettings JSON lists used for finance dropdowns.
 * Handles string[], legacy shapes, and accidental JSON strings.
 */
export function normalizeFinanceOptionList(value: unknown): string[] {
  if (value == null || value === "") return [];

  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      return Array.from(
        new Set(
          value
            .split(/\r?\n|,/g)
            .map((x) => x.trim())
            .filter(Boolean),
        ),
      );
    }
  }

  if (!Array.isArray(parsed)) return [];

  const out: string[] = [];
  for (const item of parsed) {
    if (typeof item === "string") {
      const t = item.trim();
      if (t) out.push(t);
      continue;
    }
    if (item && typeof item === "object" && "label" in item && typeof (item as { label: unknown }).label === "string") {
      const t = String((item as { label: string }).label).trim();
      if (t) out.push(t);
    }
  }
  return Array.from(new Set(out));
}

export function mergeCurrencyOptions(saved: unknown, defaultCurrency: string): string[] {
  const base = normalizeFinanceOptionList(saved);
  const dc = defaultCurrency.trim().toUpperCase();
  const merged = dc ? [dc, ...base.filter((x) => x.toUpperCase() !== dc)] : base;
  return Array.from(new Set(merged.map((x) => x.toUpperCase())));
}
