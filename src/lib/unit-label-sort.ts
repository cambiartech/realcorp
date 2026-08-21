/** Numeric-aware sort so RM 2 sits before RM 10 after save. */
export function compareByUnitLabel(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

export function sortByUnitLabel<T>(rows: T[], getLabel: (row: T) => string): T[] {
  return [...rows].sort((a, b) => compareByUnitLabel(getLabel(a), getLabel(b)));
}
