export type WorkTaskRecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

export type WorkTaskRecurrenceEndMode = "NEVER" | "UNTIL_DATE" | "AFTER_COUNT";

export type SpawnableWorkTask = {
  title: string;
  description: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  spaceId: string | null;
  projectId: string | null;
  assigneeUserId: string | null;
  createdByUserId: string;
  dueDate: Date | null;
  sprintLabel: string | null;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  recurrenceFrequency: WorkTaskRecurrenceFrequency | null;
  recurrenceSeriesId: string | null;
  recurrenceIndex: number | null;
  recurrenceEndsAt: Date | null;
  recurrenceMaxOccurrences: number | null;
  recurrenceActive: boolean;
};

export function advanceWorkTaskDueDate(date: Date, frequency: WorkTaskRecurrenceFrequency): Date {
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

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Whether completing this occurrence should create the next one. */
export function shouldSpawnNextWorkTask(task: SpawnableWorkTask): boolean {
  if (!task.recurrenceActive) return false;
  if (!task.recurrenceFrequency) return false;
  if (!task.recurrenceSeriesId) return false;
  if (!task.dueDate) return false;

  const nextIndex = (task.recurrenceIndex ?? 0) + 1;
  if (
    task.recurrenceMaxOccurrences != null &&
    nextIndex >= task.recurrenceMaxOccurrences
  ) {
    return false;
  }

  const nextDue = advanceWorkTaskDueDate(task.dueDate, task.recurrenceFrequency);
  if (task.recurrenceEndsAt) {
    if (startOfDay(nextDue).getTime() > startOfDay(task.recurrenceEndsAt).getTime()) {
      return false;
    }
  }

  return true;
}

export function buildNextWorkTaskOccurrence(task: SpawnableWorkTask): {
  title: string;
  description: string | null;
  priority: SpawnableWorkTask["priority"];
  spaceId: string | null;
  projectId: string | null;
  assigneeUserId: string | null;
  createdByUserId: string;
  dueDate: Date;
  sprintLabel: string | null;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  recurrenceFrequency: WorkTaskRecurrenceFrequency;
  recurrenceSeriesId: string;
  recurrenceIndex: number;
  recurrenceEndsAt: Date | null;
  recurrenceMaxOccurrences: number | null;
  recurrenceActive: true;
} | null {
  if (!shouldSpawnNextWorkTask(task)) return null;
  if (!task.dueDate || !task.recurrenceFrequency || !task.recurrenceSeriesId) return null;

  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    spaceId: task.spaceId,
    projectId: task.projectId,
    assigneeUserId: task.assigneeUserId,
    createdByUserId: task.createdByUserId,
    dueDate: advanceWorkTaskDueDate(task.dueDate, task.recurrenceFrequency),
    sprintLabel: task.sprintLabel,
    linkedEntityType: task.linkedEntityType,
    linkedEntityId: task.linkedEntityId,
    recurrenceFrequency: task.recurrenceFrequency,
    recurrenceSeriesId: task.recurrenceSeriesId,
    recurrenceIndex: (task.recurrenceIndex ?? 0) + 1,
    recurrenceEndsAt: task.recurrenceEndsAt,
    recurrenceMaxOccurrences: task.recurrenceMaxOccurrences,
    recurrenceActive: true,
  };
}

export function recurrenceFrequencyLabel(frequency: WorkTaskRecurrenceFrequency | null | undefined): string | null {
  if (!frequency) return null;
  if (frequency === "DAILY") return "Repeats daily";
  if (frequency === "WEEKLY") return "Repeats weekly";
  return "Repeats monthly";
}
