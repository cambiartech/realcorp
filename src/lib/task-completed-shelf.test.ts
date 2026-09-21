import assert from "node:assert/strict";
import test from "node:test";
import { isCompletedTaskOnActiveShelf, TASK_COMPLETED_SHELF_DAYS } from "./task-completed-shelf";

const now = Date.parse("2026-09-21T12:00:00.000Z");

test("keeps non-done tasks on the shelf", () => {
  assert.equal(isCompletedTaskOnActiveShelf({ status: "TODO" }, now), true);
  assert.equal(isCompletedTaskOnActiveShelf({ status: "IN_PROGRESS", completedAt: null }, now), true);
});

test("keeps recent done tasks on the shelf", () => {
  const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(isCompletedTaskOnActiveShelf({ status: "DONE", completedAt: threeDaysAgo }, now), true);
});

test("removes done tasks older than the shelf window", () => {
  const old = new Date(now - (TASK_COMPLETED_SHELF_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
  assert.equal(isCompletedTaskOnActiveShelf({ status: "DONE", completedAt: old }, now), false);
});

test("keeps done tasks with missing completedAt", () => {
  assert.equal(isCompletedTaskOnActiveShelf({ status: "DONE", completedAt: null }, now), true);
});
