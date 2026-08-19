export type SortDir = "asc" | "desc";

export function nextSortState(
  currentKey: string | null,
  currentDir: SortDir,
  clickedKey: string,
): { key: string | null; dir: SortDir } {
  if (currentKey !== clickedKey) return { key: clickedKey, dir: "asc" };
  if (currentDir === "asc") return { key: clickedKey, dir: "desc" };
  return { key: null, dir: "asc" };
}

export function compareTableValues(a: unknown, b: unknown): number {
  const emptyA = a == null || a === "";
  const emptyB = b == null || b === "";
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;
  if (typeof a === "number" && typeof b === "number") {
    if (Number.isNaN(a) && Number.isNaN(b)) return 0;
    if (Number.isNaN(a)) return 1;
    if (Number.isNaN(b)) return -1;
    return a - b;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function sortTableRows<T>(
  rows: T[],
  key: string | null,
  dir: SortDir,
  getValue: (row: T, key: string) => unknown,
): T[] {
  if (!key) return rows;
  const copy = [...rows];
  const mul = dir === "asc" ? 1 : -1;
  copy.sort((a, b) => mul * compareTableValues(getValue(a, key), getValue(b, key)));
  return copy;
}
