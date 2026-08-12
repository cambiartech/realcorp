export type LeaveDayUnit = "WORKING_DAYS" | "CALENDAR_DAYS" | "HOURS";
export type LeaveAccrualMethod = "ANNUAL_GRANT" | "MONTHLY" | "NONE";

export type LeavePolicyInput = {
  annualEntitlement: number;
  accrualMethod: LeaveAccrualMethod;
  minimumServiceMonths: number;
  unlimited: boolean;
};

const DAY_MS = 86_400_000;

export function parseLeaveDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Enter a valid leave date.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Enter a valid leave date.");
  }
  return date;
}

export function leaveDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function countLeaveUnits(input: {
  startDate: Date;
  endDate: Date;
  dayUnit: LeaveDayUnit;
  holidayDates?: Iterable<string>;
  hoursPerWorkingDay?: number;
}) {
  const start = Date.UTC(
    input.startDate.getUTCFullYear(),
    input.startDate.getUTCMonth(),
    input.startDate.getUTCDate(),
  );
  const end = Date.UTC(
    input.endDate.getUTCFullYear(),
    input.endDate.getUTCMonth(),
    input.endDate.getUTCDate(),
  );
  if (end < start) throw new Error("Leave end date cannot be before the start date.");
  const holidays = new Set(input.holidayDates ?? []);
  let workingDays = 0;
  let calendarDays = 0;

  for (let cursor = start; cursor <= end; cursor += DAY_MS) {
    calendarDays += 1;
    const date = new Date(cursor);
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6 && !holidays.has(leaveDateKey(date))) {
      workingDays += 1;
    }
  }

  if (input.dayUnit === "CALENDAR_DAYS") return calendarDays;
  if (input.dayUnit === "HOURS") return workingDays * (input.hoursPerWorkingDay ?? 8);
  return workingDays;
}

export function completedServiceMonths(dateOfJoining: Date | null | undefined, asOf: Date) {
  if (!dateOfJoining || dateOfJoining > asOf) return 0;
  let months =
    (asOf.getUTCFullYear() - dateOfJoining.getUTCFullYear()) * 12 +
    asOf.getUTCMonth() -
    dateOfJoining.getUTCMonth();
  if (asOf.getUTCDate() < dateOfJoining.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

export function accruedLeaveEntitlement(input: {
  policy: LeavePolicyInput;
  dateOfJoining: Date | null | undefined;
  asOf: Date;
  year: number;
}) {
  if (input.policy.unlimited) return Number.POSITIVE_INFINITY;
  const serviceMonths = completedServiceMonths(input.dateOfJoining, input.asOf);
  if (serviceMonths < input.policy.minimumServiceMonths) return 0;
  if (input.policy.accrualMethod === "NONE") return input.policy.annualEntitlement;
  if (input.policy.accrualMethod === "ANNUAL_GRANT") return input.policy.annualEntitlement;

  const monthsElapsed = Math.min(12, input.asOf.getUTCMonth() + 1);
  const employmentStartYear = input.dateOfJoining?.getUTCFullYear();
  const employmentMonths =
    employmentStartYear === input.year && input.dateOfJoining
      ? Math.max(0, input.asOf.getUTCMonth() - input.dateOfJoining.getUTCMonth() + 1)
      : monthsElapsed;
  return round2((input.policy.annualEntitlement / 12) * Math.min(monthsElapsed, employmentMonths));
}

export function availableLeaveUnits(input: {
  accrued: number;
  carried: number;
  adjustment: number;
  approved: number;
  pending: number;
  unlimited: boolean;
}) {
  if (input.unlimited) return Number.POSITIVE_INFINITY;
  return round2(input.accrued + input.carried + input.adjustment - input.approved - input.pending);
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
