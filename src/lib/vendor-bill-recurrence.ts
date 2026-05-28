export type VendorBillRecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

export type RecurrenceRangeMode = "FISCAL_YEAR_END" | "END_DATE" | "PERIOD_COUNT";

export type RecurrenceRangeInput =
  | { mode: "FISCAL_YEAR_END"; fiscalYearEnd: Date }
  | { mode: "END_DATE"; endDate: Date }
  | { mode: "PERIOD_COUNT"; periodCount: number };

/** Safety cap so a bad range cannot create unbounded rows. */
export const MAX_RECURRENCE_PERIODS = 366;

const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const mediumDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" });

export function buildVendorBillTitle(
  vendorName: string,
  dueDate: Date | null,
  frequency: VendorBillRecurrenceFrequency | null,
): string {
  const vendor = vendorName.trim() || "Vendor";
  if (!dueDate) return `${vendor} bill`;

  if (frequency === "DAILY") {
    return `${vendor} — ${shortDate.format(dueDate)}`;
  }
  if (frequency === "WEEKLY") {
    return `${vendor} — Week of ${shortDate.format(dueDate)}`;
  }

  const monthYear = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(dueDate);
  return `${vendor} — ${monthYear}`;
}

export function parseDueDateInput(value?: string): Date | null {
  if (!value?.trim()) return null;
  const parsed = new Date(`${value.trim()}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function advanceDueDate(date: Date, frequency: VendorBillRecurrenceFrequency): Date {
  const next = new Date(date);
  if (frequency === "DAILY") {
    next.setDate(next.getDate() + 1);
  } else if (frequency === "WEEKLY") {
    next.setDate(next.getDate() + 7);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}

export function recurrencePeriodsInRange(
  vendorName: string,
  anchor: Date,
  frequency: VendorBillRecurrenceFrequency,
  range: RecurrenceRangeInput,
): Array<{ dueDate: Date; title: string; index: number }> {
  const periods: Array<{ dueDate: Date; title: string; index: number }> = [];
  let cursor = new Date(anchor);
  let index = 0;

  const endInclusive =
    range.mode === "FISCAL_YEAR_END"
      ? startOfDay(range.fiscalYearEnd)
      : range.mode === "END_DATE"
        ? startOfDay(range.endDate)
        : null;

  while (index < MAX_RECURRENCE_PERIODS) {
    if (range.mode === "PERIOD_COUNT") {
      if (index >= range.periodCount) break;
    } else if (endInclusive && startOfDay(cursor).getTime() > endInclusive.getTime()) {
      break;
    }

    periods.push({
      dueDate: new Date(cursor),
      title: buildVendorBillTitle(vendorName, cursor, frequency),
      index,
    });

    index += 1;
    cursor = advanceDueDate(cursor, frequency);
  }

  return periods;
}

export function recurrenceFrequencyLabel(frequency: VendorBillRecurrenceFrequency): string {
  if (frequency === "DAILY") return "Daily";
  if (frequency === "WEEKLY") return "Weekly";
  return "Monthly";
}

export function recurrencePeriodUnitLabel(frequency: VendorBillRecurrenceFrequency): string {
  if (frequency === "DAILY") return "days";
  if (frequency === "WEEKLY") return "weeks";
  return "months";
}

export function describeRecurrenceRange(
  range: RecurrenceRangeInput,
  frequency: VendorBillRecurrenceFrequency,
  billCount: number,
): string {
  if (range.mode === "PERIOD_COUNT") {
    return `${billCount} ${recurrenceFrequencyLabel(frequency).toLowerCase()} bill(s) (${range.periodCount} ${recurrencePeriodUnitLabel(frequency)})`;
  }
  const end = range.mode === "FISCAL_YEAR_END" ? range.fiscalYearEnd : range.endDate;
  return `${billCount} ${recurrenceFrequencyLabel(frequency).toLowerCase()} bill(s) through ${mediumDate.format(end)}`;
}

export function buildRecurrenceRangeInput(
  mode: RecurrenceRangeMode,
  options: {
    fiscalYearEnd?: Date | null;
    endDate?: string;
    periodCount?: number;
  },
): RecurrenceRangeInput | null {
  if (mode === "FISCAL_YEAR_END" && options.fiscalYearEnd) {
    return { mode: "FISCAL_YEAR_END", fiscalYearEnd: options.fiscalYearEnd };
  }
  if (mode === "END_DATE") {
    const parsed = parseDueDateInput(options.endDate);
    if (!parsed) return null;
    return { mode: "END_DATE", endDate: parsed };
  }
  if (mode === "PERIOD_COUNT" && options.periodCount && options.periodCount >= 1) {
    return { mode: "PERIOD_COUNT", periodCount: Math.min(options.periodCount, MAX_RECURRENCE_PERIODS) };
  }
  return null;
}
