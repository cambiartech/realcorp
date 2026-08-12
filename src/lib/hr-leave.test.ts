import assert from "node:assert/strict";
import test from "node:test";
import {
  accruedLeaveEntitlement,
  availableLeaveUnits,
  countLeaveUnits,
  parseLeaveDate,
} from "./hr-leave";

test("working-day leave excludes weekends and configured holidays", () => {
  assert.equal(
    countLeaveUnits({
      startDate: parseLeaveDate("2026-08-10"),
      endDate: parseLeaveDate("2026-08-17"),
      dayUnit: "WORKING_DAYS",
      holidayDates: ["2026-08-12"],
    }),
    5,
  );
});

test("calendar-day policies include weekends", () => {
  assert.equal(
    countLeaveUnits({
      startDate: parseLeaveDate("2026-08-10"),
      endDate: parseLeaveDate("2026-08-17"),
      dayUnit: "CALENDAR_DAYS",
    }),
    8,
  );
});

test("monthly accrual respects hire date and service waiting period", () => {
  const accrued = accruedLeaveEntitlement({
    policy: {
      annualEntitlement: 24,
      accrualMethod: "MONTHLY",
      minimumServiceMonths: 3,
      unlimited: false,
    },
    dateOfJoining: parseLeaveDate("2026-01-15"),
    asOf: parseLeaveDate("2026-08-31"),
    year: 2026,
  });
  assert.equal(accrued, 16);
});

test("pending requests reserve available balance", () => {
  assert.equal(
    availableLeaveUnits({
      accrued: 20,
      carried: 2,
      adjustment: 1,
      approved: 5,
      pending: 3,
      unlimited: false,
    }),
    15,
  );
});
