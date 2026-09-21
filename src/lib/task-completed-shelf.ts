/** Done tasks leave the active board after this many days; they remain in Completed history. */
export const TASK_COMPLETED_SHELF_DAYS = 7;

const SHELF_MS = TASK_COMPLETED_SHELF_DAYS * 24 * 60 * 60 * 1000;

export function isCompletedTaskOnActiveShelf(
  task: { status: string; completedAt?: string | null },
  nowMs = Date.now(),
): boolean {
  if (task.status !== "DONE") return true;
  if (!task.completedAt) return true;
  const completedMs = new Date(task.completedAt).getTime();
  if (Number.isNaN(completedMs)) return true;
  return nowMs - completedMs < SHELF_MS;
}
