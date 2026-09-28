import assert from "node:assert/strict";
import test from "node:test";
import { assigneeSummary, normalizeAssigneeIds } from "./task-assignees";

test("assignee ids stay unique and keep the first person first", () => {
  assert.deepEqual(normalizeAssigneeIds(["b", "a", "b", " ", "a"]), ["b", "a"]);
});

test("assignee summary names two people and folds the rest", () => {
  assert.equal(assigneeSummary([]), "Unassigned");
  assert.equal(assigneeSummary(["Ada"]), "Ada");
  assert.equal(assigneeSummary(["Ada", "Tunde"]), "Ada, Tunde");
  assert.equal(assigneeSummary(["Ada", "Tunde", "Ife"]), "Ada +2");
});
