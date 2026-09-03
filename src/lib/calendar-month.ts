/** Calendar-month keys (`YYYY-MM`) for overview / dashboard period filters. */

const MONTH_KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function currentMonthKey(at: Date = new Date()): string {
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}`;
}

export function parseMonthKey(key: string | null | undefined): { year: number; month: number } | null {
  if (!key) return null;
  const match = MONTH_KEY_RE.exec(key.trim());
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function resolveMonthKey(key: string | null | undefined, at: Date = new Date()): string {
  return parseMonthKey(key) ? key!.trim() : currentMonthKey(at);
}

export function monthBounds(key: string, at: Date = new Date()): { start: Date; end: Date; key: string } {
  const resolved = resolveMonthKey(key, at);
  const parsed = parseMonthKey(resolved)!;
  const start = new Date(parsed.year, parsed.month - 1, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(parsed.year, parsed.month, 1);
  return { start, end, key: resolved };
}

export function shiftMonthKey(key: string, delta: number): string {
  const parsed = parseMonthKey(key);
  const base = parsed ? new Date(parsed.year, parsed.month - 1, 1) : new Date();
  base.setMonth(base.getMonth() + delta);
  return currentMonthKey(base);
}

export function monthLongLabel(key: string): string {
  const parsed = parseMonthKey(key);
  if (!parsed) return key;
  return new Intl.DateTimeFormat("en-NG", { month: "long", year: "numeric" }).format(
    new Date(parsed.year, parsed.month - 1, 1),
  );
}

export function monthShortLabel(key: string): string {
  const parsed = parseMonthKey(key);
  if (!parsed) return key;
  return new Intl.DateTimeFormat("en-NG", { month: "short", year: "numeric" }).format(
    new Date(parsed.year, parsed.month - 1, 1),
  );
}

export function minMonthKey(maxKey: string, monthsBack: number): string {
  return shiftMonthKey(maxKey, -Math.max(0, monthsBack));
}

export function compareMonthKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

export function isInHalfOpenRange(value: Date, start: Date, end: Date): boolean {
  return value >= start && value < end;
}
