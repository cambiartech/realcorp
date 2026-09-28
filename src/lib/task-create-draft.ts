export type TaskCreateDraft = {
  title: string;
  description: string;
  spaceId: string;
  projectId: string;
  assigneeUserIds: string[];
  priority: string;
  dueDate: string;
  sprintLabel: string;
  recurrenceFrequency: string;
  recurrenceEndMode: string;
  recurrenceEndsAt: string;
  recurrenceMaxOccurrences: string;
  taskId?: string;
};

export function taskCreateDraftKey(tenantSlug: string, userId: string) {
  return `boerp-task-create:${tenantSlug}:${userId}`;
}

function field(fd: FormData, name: string) {
  return String(fd.get(name) || "").trim();
}

export function draftFromFormData(fd: FormData): TaskCreateDraft {
  return {
    title: field(fd, "title"),
    description: field(fd, "description"),
    spaceId: field(fd, "spaceId"),
    projectId: field(fd, "projectId"),
    assigneeUserIds: fd.getAll("assigneeUserIds").map(String).filter(Boolean),
    priority: field(fd, "priority") || "MEDIUM",
    dueDate: field(fd, "dueDate"),
    sprintLabel: field(fd, "sprintLabel"),
    recurrenceFrequency: field(fd, "recurrenceFrequency"),
    recurrenceEndMode: field(fd, "recurrenceEndMode") || "NEVER",
    recurrenceEndsAt: field(fd, "recurrenceEndsAt"),
    recurrenceMaxOccurrences: field(fd, "recurrenceMaxOccurrences"),
  };
}

export function draftHasContent(draft: TaskCreateDraft) {
  return Boolean(
    draft.title ||
      draft.description ||
      draft.dueDate ||
      draft.sprintLabel ||
      draft.projectId ||
      draft.recurrenceFrequency,
  );
}

export function readTaskCreateDraft(tenantSlug: string, userId: string): TaskCreateDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(taskCreateDraftKey(tenantSlug, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TaskCreateDraft;
    if (!parsed || typeof parsed !== "object" || !draftHasContent(parsed)) return null;
    return {
      ...draftFromFormData(new FormData()),
      ...parsed,
      assigneeUserIds: Array.isArray(parsed.assigneeUserIds)
        ? parsed.assigneeUserIds.filter((id) => typeof id === "string" && id)
        : [],
    };
  } catch {
    return null;
  }
}

export function writeTaskCreateDraft(tenantSlug: string, userId: string, draft: TaskCreateDraft) {
  if (typeof window === "undefined") return;
  try {
    if (!draftHasContent(draft)) {
      window.localStorage.removeItem(taskCreateDraftKey(tenantSlug, userId));
      return;
    }
    window.localStorage.setItem(taskCreateDraftKey(tenantSlug, userId), JSON.stringify(draft));
  } catch {
    // storage can be full or blocked; the form still submits
  }
}

export function clearTaskCreateDraft(tenantSlug: string, userId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(taskCreateDraftKey(tenantSlug, userId));
  } catch {
    // ignore
  }
}
