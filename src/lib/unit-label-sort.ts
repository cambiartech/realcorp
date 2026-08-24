/** Pull a room/unit number so RM 2 sits before RM 10 after save. */
function unitNumber(label: string): number | null {
  const room = label.match(/\b(?:rm|room|unit|apt|apartment|#)\s*(\d+)\b/i);
  if (room) return Number(room[1]);
  const leading = label.match(/^\s*(\d+)\b/);
  if (leading) return Number(leading[1]);
  const any = label.match(/(\d+)/);
  return any ? Number(any[1]) : null;
}

export function compareByUnitLabel(a: string, b: string) {
  const na = unitNumber(a);
  const nb = unitNumber(b);
  if (na != null && nb != null && na !== nb) return na - nb;
  if (na != null && nb == null) return -1;
  if (na == null && nb != null) return 1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function sortByUnitLabel<T>(rows: T[], getLabel: (row: T) => string): T[] {
  return [...rows].sort((a, b) => compareByUnitLabel(getLabel(a), getLabel(b)));
}
