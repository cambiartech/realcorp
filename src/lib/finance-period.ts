import {
  currentMonthKey,
  monthBounds,
  monthLongLabel,
  resolveMonthKey,
  shiftMonthKey,
} from "@/lib/calendar-month";

export type FinancePeriodPreset = "month" | "year" | "custom";

export type FinancePeriodQuery = {
  period?: string;
  month?: string;
  year?: string;
  from?: string;
  to?: string;
};

export type ResolvedFinancePeriod = {
  preset: FinancePeriodPreset;
  start: Date;
  end: Date;
  fromKey: string;
  toKey: string;
  monthKey: string;
  year: number;
  label: string;
  collectedLabel: string;
  expensesLabel: string;
  priorStart: Date;
  priorEnd: Date;
  priorLabel: string;
  isDefault: boolean;
};

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function dateKey(value: Date): string {
  return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
}

export function parseDateKey(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = DATE_KEY_RE.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const next = new Date(year, month - 1, day);
  if (
    next.getFullYear() !== year ||
    next.getMonth() !== month - 1 ||
    next.getDate() !== day
  ) {
    return null;
  }
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function exclusiveEnd(inclusiveTo: Date) {
  const next = startOfDay(inclusiveTo);
  next.setDate(next.getDate() + 1);
  return next;
}

function formatDay(value: Date) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

export function clampFinanceYear(year: number, at: Date = new Date()) {
  const max = at.getFullYear();
  const min = max - 5;
  if (!Number.isFinite(year)) return max;
  return Math.min(max, Math.max(min, Math.trunc(year)));
}

export function resolveFinancePeriod(
  query: FinancePeriodQuery,
  at: Date = new Date(),
): ResolvedFinancePeriod {
  const requested =
    query.period === "year" || query.period === "custom"
      ? query.period
      : query.from || query.to
        ? "custom"
        : "month";

  if (requested === "year") {
    const year = clampFinanceYear(Number(query.year) || at.getFullYear(), at);
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    const isThisYear = year === at.getFullYear();
    return {
      preset: "year",
      start,
      end,
      fromKey: dateKey(start),
      toKey: dateKey(new Date(year, 11, 31)),
      monthKey: currentMonthKey(at),
      year,
      label: String(year),
      collectedLabel: isThisYear ? "Collected this year" : `Collected in ${year}`,
      expensesLabel: isThisYear ? "Expenses this year" : `Expenses · ${year}`,
      priorStart: new Date(year - 1, 0, 1),
      priorEnd: start,
      priorLabel: String(year - 1),
      isDefault: false,
    };
  }

  if (requested === "custom") {
    let from = parseDateKey(query.from) || new Date(at.getFullYear(), at.getMonth(), 1);
    let to = parseDateKey(query.to) || startOfDay(at);
    if (to < from) {
      const swap = from;
      from = to;
      to = swap;
    }
    const start = startOfDay(from);
    const inclusiveTo = startOfDay(to);
    const end = exclusiveEnd(inclusiveTo);
    const durationMs = end.getTime() - start.getTime();
    const priorEnd = start;
    const priorStart = new Date(start.getTime() - durationMs);
    const label = `${formatDay(start)} – ${formatDay(inclusiveTo)}`;
    return {
      preset: "custom",
      start,
      end,
      fromKey: dateKey(start),
      toKey: dateKey(inclusiveTo),
      monthKey: currentMonthKey(start),
      year: start.getFullYear(),
      label,
      collectedLabel: `Collected · ${label}`,
      expensesLabel: `Expenses · ${label}`,
      priorStart,
      priorEnd,
      priorLabel: `${formatDay(priorStart)} – ${formatDay(new Date(priorEnd.getTime() - 1))}`,
      isDefault: false,
    };
  }

  const monthKey = resolveMonthKey(query.month, at);
  const bounds = monthBounds(monthKey, at);
  const prior = monthBounds(shiftMonthKey(monthKey, -1), at);
  const isDefault = monthKey === currentMonthKey(at);
  const label = monthLongLabel(monthKey);
  return {
    preset: "month",
    start: bounds.start,
    end: bounds.end,
    fromKey: dateKey(bounds.start),
    toKey: dateKey(new Date(bounds.end.getTime() - 1)),
    monthKey,
    year: bounds.start.getFullYear(),
    label,
    collectedLabel: isDefault ? "Collected this month" : `Collected · ${label}`,
    expensesLabel: isDefault ? "Expenses this month" : `Expenses · ${label}`,
    priorStart: prior.start,
    priorEnd: prior.end,
    priorLabel: monthLongLabel(prior.key),
    isDefault,
  };
}

export function financePeriodHrefParams(period: {
  preset: FinancePeriodPreset;
  monthKey: string;
  year: number;
  fromKey: string;
  toKey: string;
}): Record<string, string> {
  if (period.preset === "year") {
    return { period: "year", year: String(period.year) };
  }
  if (period.preset === "custom") {
    return { period: "custom", from: period.fromKey, to: period.toKey };
  }
  if (period.monthKey === currentMonthKey()) return {};
  return { period: "month", month: period.monthKey };
}
