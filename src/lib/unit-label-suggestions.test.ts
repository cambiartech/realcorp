import test from "node:test";
import assert from "node:assert/strict";
import { generateBulkUnitLabels } from "./unit-label-suggestions";

test("Room 1 as the first unit yields Room 1 through Room 10", () => {
  const labels = generateBulkUnitLabels({
    count: 10,
    existingLabels: [],
    baseLabel: "Room 1",
    projectName: "Hostel",
  });
  assert.deepEqual(labels, [
    "Room 1",
    "Room 2",
    "Room 3",
    "Room 4",
    "Room 5",
    "Room 6",
    "Room 7",
    "Room 8",
    "Room 9",
    "Room 10",
  ]);
});

test("existing numbered rooms are skipped instead of jumping the sequence", () => {
  const labels = generateBulkUnitLabels({
    count: 3,
    existingLabels: ["Room 1", "Room 2"],
    baseLabel: "Room 1",
    projectName: "Hostel",
  });
  assert.deepEqual(labels, ["Room 3", "Room 4", "Room 5"]);
});
