import { compareByUnitLabel } from "./unit-label-sort";
import test from "node:test";
import assert from "node:assert/strict";

test("room labels sort by number, not creation or lexicographic order", () => {
  const labels = [
    "RM 10 MR TEN",
    "RM 2 MR ADESANYA PHILIPS",
    "RM 1 PENTHOUSE",
    "RM 7 PENTHOUSE FAMILY",
  ];
  const sorted = [...labels].sort(compareByUnitLabel);
  assert.deepEqual(sorted, [
    "RM 1 PENTHOUSE",
    "RM 2 MR ADESANYA PHILIPS",
    "RM 7 PENTHOUSE FAMILY",
    "RM 10 MR TEN",
  ]);
});
