import assert from "node:assert/strict";
import test from "node:test";
import { celebratesOn, completedYears } from "./celebration-dates";
import { publicHolidayExternalId } from "./public-holidays";

test("birthday matches month and day, including leap-day fallback", () => {
  const dob = new Date("1992-08-24T00:00:00.000Z");
  assert.equal(celebratesOn(dob, new Date("2026-08-24T08:00:00.000Z")), true);
  assert.equal(celebratesOn(dob, new Date("2026-08-23T08:00:00.000Z")), false);

  const leap = new Date("1992-02-29T00:00:00.000Z");
  assert.equal(celebratesOn(leap, new Date("2024-02-29T00:00:00.000Z")), true);
  assert.equal(celebratesOn(leap, new Date("2026-02-28T00:00:00.000Z")), true);
  assert.equal(celebratesOn(leap, new Date("2026-03-01T00:00:00.000Z")), false);
});

test("work anniversary years skip the join date in year zero", () => {
  const joined = new Date("2024-08-24T00:00:00.000Z");
  assert.equal(completedYears(joined, new Date("2024-08-24T00:00:00.000Z")), 0);
  assert.equal(completedYears(joined, new Date("2026-08-24T00:00:00.000Z")), 2);
});

test("public holiday ids are stable per country and date", () => {
  assert.equal(
    publicHolidayExternalId("NG", "2026-10-01", "Independence Day"),
    "nager:NG:2026-10-01:Independence Day",
  );
});
