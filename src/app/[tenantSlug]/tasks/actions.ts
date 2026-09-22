"use server";

import { auth } from "@/auth";
import { WorkTaskStatus } from "@/generated/prisma";
import { absoluteAppUrl } from "@/lib/app-url";
import prisma from "@/lib/db";
import { sendTaskAssignedEmail } from "@/lib/email";
import { canAccessWorkTask, canManageTasks, canViewTasksModule } from "@/lib/tasks-access";
import {
  isTaskAssigneeAllowed,
  type TaskAssigneeMember,
} from "@/lib/membership-departments";
import { loadManageeUserIds } from "@/lib/employee-task-managers";
import {
  buildNextWorkTaskOccurrence,
  type SpawnableWorkTask,
  type WorkTaskRecurrenceFrequency,
} from "@/lib/work-task-recurrence";
import {
  createWorkTaskInputSchema,
  createTaskSpaceInputSchema,
  deleteWorkTaskInputSchema,
  stopWorkTaskRecurrenceInputSchema,
  updateWorkTaskInputSchema,
  updateWorkTaskStatusInputSchema,
} from "@/lib/validators/tasks";
import { revalidatePath } from "next/cache";

type ActionResult = { ok: true } | { ok: false; error: string };

const SPAWN_SELECT = {
  id: true,
  title: true,
  description: true,
  priority: true,
  spaceId: true,
  projectId: true,
  assigneeUserId: true,
  createdByUserId: true,
  dueDate: true,
  sprintLabel: true,
  linkedEntityType: true,
  linkedEntityId: true,
  recurrenceFrequency: true,
  recurrenceSeriesId: true,
  recurrenceIndex: true,
  recurrenceEndsAt: true,
  recurrenceMaxOccurrences: true,
  recurrenceActive: true,
  status: true,
} as const;

async function getTenantContext(tenantSlug: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, name: true, settings: { select: { moduleTasks: true } } },
  });
  if (!tenant) return null;

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { status: true, role: true, department: true, isDepartmentLead: true },
  });

  const moduleTasks = tenant.settings?.moduleTasks ?? true;
  if (!canViewTasksModule(Boolean(session.user.isPlatformAdmin), membership, moduleTasks)) {
    return null;
  }

  return { tenant, session, membership };
}

async function loadAssigneeMembers(tenantId: string): Promise<TaskAssigneeMember[]> {
  const memberships = await prisma.membership.findMany({
    where: { tenantId, status: "ACTIVE" },
    include: { user: { select: { id: true, name: true, email: true } } },
    take: 200,
  });
  return memberships.map((m) => ({
    id: m.user.id,
    label: m.user.name || m.user.email || "Member",
    role: m.role,
    department: m.department,
    isDepartmentLead: m.isDepartmentLead,
  }));
}

async function assertAssigneeAllowed(
  ctx: NonNullable<Awaited<ReturnType<typeof getTenantContext>>>,
  assigneeUserId: string | null | undefined,
): Promise<ActionResult | null> {
  if (!assigneeUserId) return null;
  const members = await loadAssigneeMembers(ctx.tenant.id);
  const allowed = isTaskAssigneeAllowed(assigneeUserId, members, {
    isPlatformAdmin: Boolean(ctx.session.user.isPlatformAdmin),
    actorRole: ctx.membership?.role,
    actorUserId: ctx.session.user.id,
    actorDepartment: ctx.membership?.department ?? undefined,
    actorIsDepartmentLead: ctx.membership?.isDepartmentLead,
    manageeUserIds: await loadManageeUserIds(ctx.tenant.id, ctx.session.user.id),
  });
  if (!allowed) {
    return {
      ok: false,
      error:
        "You can assign within your department, to org admins / HR, or to people who list you as a task manager on their People record.",
    };
  }
  return null;
}

async function assertCanAccessTask(
  ctx: NonNullable<Awaited<ReturnType<typeof getTenantContext>>>,
  task: { createdByUserId: string; assigneeUserId: string | null },
): Promise<ActionResult | null> {
  const members = await loadAssigneeMembers(ctx.tenant.id);
  const allowed = canAccessWorkTask({
    isPlatformAdmin: Boolean(ctx.session.user.isPlatformAdmin),
    actorUserId: ctx.session.user.id,
    membership: ctx.membership,
    task,
    members,
  });
  if (!allowed) return { ok: false, error: "You do not have access to this task." };
  return null;
}

function formatTaskDueLabel(dueDate?: string | Date | null) {
  if (!dueDate) return null;
  const date = dueDate instanceof Date ? dueDate : new Date(dueDate);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(date);
}

function formatTaskPriority(priority?: string | null) {
  if (!priority) return null;
  return priority.charAt(0) + priority.slice(1).toLowerCase();
}

function parseOptionalDate(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  const date = new Date(`${value.trim()}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveRecurrenceFields(input: {
  recurrenceFrequency?: "DAILY" | "WEEKLY" | "MONTHLY" | null;
  recurrenceEndMode?: "NEVER" | "UNTIL_DATE" | "AFTER_COUNT";
  recurrenceEndsAt?: string;
  recurrenceMaxOccurrences?: number | null;
}): {
  recurrenceFrequency: WorkTaskRecurrenceFrequency | null;
  recurrenceEndsAt: Date | null;
  recurrenceMaxOccurrences: number | null;
  recurrenceActive: boolean;
} {
  const frequency = input.recurrenceFrequency ?? null;
  if (!frequency) {
    return {
      recurrenceFrequency: null,
      recurrenceEndsAt: null,
      recurrenceMaxOccurrences: null,
      recurrenceActive: false,
    };
  }
  const endMode = input.recurrenceEndMode ?? "NEVER";
  return {
    recurrenceFrequency: frequency,
    recurrenceEndsAt: endMode === "UNTIL_DATE" ? parseOptionalDate(input.recurrenceEndsAt) : null,
    recurrenceMaxOccurrences:
      endMode === "AFTER_COUNT" ? (input.recurrenceMaxOccurrences ?? null) : null,
    recurrenceActive: true,
  };
}

async function spawnNextIfNeeded(
  tenantId: string,
  task: SpawnableWorkTask & { id: string; status: WorkTaskStatus },
) {
  const next = buildNextWorkTaskOccurrence(task);
  if (!next) return null;

  // Avoid duplicate active heads if two DONE transitions race.
  const existingActive = await prisma.workTask.findFirst({
    where: {
      tenantId,
      recurrenceSeriesId: next.recurrenceSeriesId,
      recurrenceActive: true,
      status: { notIn: [WorkTaskStatus.DONE, WorkTaskStatus.CANCELLED] },
      id: { not: task.id },
    },
    select: { id: true },
  });
  if (existingActive) return null;

  return prisma.workTask.create({
    data: {
      tenantId,
      title: next.title,
      description: next.description,
      status: WorkTaskStatus.TODO,
      priority: next.priority,
      spaceId: next.spaceId,
      projectId: next.projectId,
      assigneeUserId: next.assigneeUserId,
      createdByUserId: next.createdByUserId,
      dueDate: next.dueDate,
      sprintLabel: next.sprintLabel,
      linkedEntityType: next.linkedEntityType,
      linkedEntityId: next.linkedEntityId,
      recurrenceFrequency: next.recurrenceFrequency,
      recurrenceSeriesId: next.recurrenceSeriesId,
      recurrenceIndex: next.recurrenceIndex,
      recurrenceEndsAt: next.recurrenceEndsAt,
      recurrenceMaxOccurrences: next.recurrenceMaxOccurrences,
      recurrenceActive: true,
      completedAt: null,
    },
  });
}

async function notifyTaskAssignee(input: {
  tenantSlug: string;
  tenantName: string;
  assignerLabel: string;
  assignerUserId: string;
  assigneeUserId: string | null | undefined;
  taskTitle: string;
  taskDescription?: string | null;
  dueDate?: string | Date | null;
  priority?: string | null;
}) {
  try {
    if (!input.assigneeUserId || input.assigneeUserId === input.assignerUserId) return;
    const assignee = await prisma.user.findUnique({
      where: { id: input.assigneeUserId },
      select: { email: true, name: true },
    });
    if (!assignee?.email) return;
    await sendTaskAssignedEmail({
      to: assignee.email,
      tenantName: input.tenantName,
      assigneeName: assignee.name || assignee.email,
      assignerLabel: input.assignerLabel,
      taskTitle: input.taskTitle,
      taskDescription: input.taskDescription,
      dueDateLabel: formatTaskDueLabel(input.dueDate),
      priority: formatTaskPriority(input.priority),
      taskUrl: absoluteAppUrl(`/${input.tenantSlug}/tasks`),
    });
  } catch {
    // Task create/update should still succeed if email delivery fails.
  }
}

export async function createWorkTask(
  tenantSlug: string,
  input: {
    title: string;
    description?: string;
    status?: WorkTaskStatus;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    spaceId?: string;
    projectId?: string;
    assigneeUserId?: string;
    dueDate?: string;
    sprintLabel?: string;
    recurrenceFrequency?: "DAILY" | "WEEKLY" | "MONTHLY" | null;
    recurrenceEndMode?: "NEVER" | "UNTIL_DATE" | "AFTER_COUNT";
    recurrenceEndsAt?: string;
    recurrenceMaxOccurrences?: number | null;
  },
): Promise<ActionResult & { taskId?: string }> {
  const ctx = await getTenantContext(tenantSlug);
  if (!ctx) return { ok: false, error: "You do not have access." };

  const parsed = createWorkTaskInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  const assigneeError = await assertAssigneeAllowed(ctx, parsed.data.assigneeUserId);
  if (assigneeError) return assigneeError;

  const status = parsed.data.status ?? WorkTaskStatus.TODO;
  const completedAt = status === WorkTaskStatus.DONE ? new Date() : null;
  const recurrence = resolveRecurrenceFields(parsed.data);
  const seriesId = recurrence.recurrenceFrequency ? crypto.randomUUID() : null;

  const created = await prisma.workTask.create({
    data: {
      tenantId: ctx.tenant.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      status,
      priority: parsed.data.priority ?? "MEDIUM",
      spaceId: parsed.data.spaceId || null,
      projectId: parsed.data.projectId || null,
      assigneeUserId: parsed.data.assigneeUserId || null,
      dueDate: parsed.data.dueDate ? parseOptionalDate(parsed.data.dueDate) : null,
      sprintLabel: parsed.data.sprintLabel || null,
      completedAt,
      createdByUserId: ctx.session.user.id,
      recurrenceFrequency: recurrence.recurrenceFrequency,
      recurrenceSeriesId: seriesId,
      recurrenceIndex: seriesId ? 0 : null,
      recurrenceEndsAt: recurrence.recurrenceEndsAt,
      recurrenceMaxOccurrences: recurrence.recurrenceMaxOccurrences,
      recurrenceActive: recurrence.recurrenceActive,
    },
  });

  await notifyTaskAssignee({
    tenantSlug,
    tenantName: ctx.tenant.name,
    assignerLabel: ctx.session.user.name || ctx.session.user.email || "A teammate",
    assignerUserId: ctx.session.user.id,
    assigneeUserId: parsed.data.assigneeUserId,
    taskTitle: parsed.data.title,
    taskDescription: parsed.data.description,
    dueDate: parsed.data.dueDate,
    priority: parsed.data.priority ?? "MEDIUM",
  });

  revalidatePath(`/${tenantSlug}/tasks`);
  return { ok: true, taskId: created.id };
}

export async function updateWorkTaskStatus(
  tenantSlug: string,
  taskId: string,
  status: WorkTaskStatus,
): Promise<ActionResult> {
  const ctx = await getTenantContext(tenantSlug);
  if (!ctx) return { ok: false, error: "You do not have access." };

  const parsed = updateWorkTaskStatusInputSchema.safeParse({ taskId, status });
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  const existing = await prisma.workTask.findFirst({
    where: { id: taskId, tenantId: ctx.tenant.id },
    select: SPAWN_SELECT,
  });
  if (!existing) return { ok: false, error: "Task not found." };
  const accessError = await assertCanAccessTask(ctx, existing);
  if (accessError) return accessError;

  const nextStatus = parsed.data.status;
  const becomingDone = nextStatus === WorkTaskStatus.DONE && existing.status !== WorkTaskStatus.DONE;
  const becomingCancelled =
    nextStatus === WorkTaskStatus.CANCELLED && existing.status !== WorkTaskStatus.CANCELLED;

  const spawnFrom =
    becomingDone && existing.recurrenceActive
      ? {
          ...existing,
          status: nextStatus,
          recurrenceFrequency: existing.recurrenceFrequency as WorkTaskRecurrenceFrequency | null,
        }
      : null;

  await prisma.workTask.update({
    where: { id: taskId },
    data: {
      status: nextStatus,
      completedAt: nextStatus === WorkTaskStatus.DONE ? new Date() : null,
      ...((becomingCancelled || becomingDone) && existing.recurrenceActive
        ? { recurrenceActive: false }
        : {}),
    },
  });

  if (spawnFrom) {
    await spawnNextIfNeeded(ctx.tenant.id, spawnFrom);
  }

  revalidatePath(`/${tenantSlug}/tasks`);
  return { ok: true };
}

export async function updateWorkTask(
  tenantSlug: string,
  input: {
    taskId: string;
    title: string;
    description?: string;
    status?: WorkTaskStatus;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    spaceId?: string;
    projectId?: string;
    assigneeUserId?: string;
    dueDate?: string;
    sprintLabel?: string;
    recurrenceFrequency?: "DAILY" | "WEEKLY" | "MONTHLY" | null;
    recurrenceEndMode?: "NEVER" | "UNTIL_DATE" | "AFTER_COUNT";
    recurrenceEndsAt?: string;
    recurrenceMaxOccurrences?: number | null;
  },
): Promise<ActionResult> {
  const ctx = await getTenantContext(tenantSlug);
  if (!ctx) return { ok: false, error: "You do not have access." };

  const parsed = updateWorkTaskInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  const assigneeError = await assertAssigneeAllowed(ctx, parsed.data.assigneeUserId);
  if (assigneeError) return assigneeError;

  const existing = await prisma.workTask.findFirst({
    where: { id: parsed.data.taskId, tenantId: ctx.tenant.id },
    select: SPAWN_SELECT,
  });
  if (!existing) return { ok: false, error: "Task not found." };
  const accessError = await assertCanAccessTask(ctx, existing);
  if (accessError) return accessError;

  const nextStatus = parsed.data.status ?? existing.status;
  const nextAssigneeUserId = parsed.data.assigneeUserId || null;
  const assigneeChanged = nextAssigneeUserId !== existing.assigneeUserId;
  const becomingDone = nextStatus === WorkTaskStatus.DONE && existing.status !== WorkTaskStatus.DONE;
  const becomingCancelled =
    nextStatus === WorkTaskStatus.CANCELLED && existing.status !== WorkTaskStatus.CANCELLED;

  const recurrenceInputProvided =
    parsed.data.recurrenceFrequency !== undefined ||
    parsed.data.recurrenceEndMode !== undefined ||
    parsed.data.recurrenceEndsAt !== undefined ||
    parsed.data.recurrenceMaxOccurrences !== undefined;

  let recurrencePatch: Record<string, unknown> = {};
  if (recurrenceInputProvided) {
    const recurrence = resolveRecurrenceFields({
      recurrenceFrequency: parsed.data.recurrenceFrequency,
      recurrenceEndMode: parsed.data.recurrenceEndMode,
      recurrenceEndsAt: parsed.data.recurrenceEndsAt,
      recurrenceMaxOccurrences: parsed.data.recurrenceMaxOccurrences,
    });
    if (!recurrence.recurrenceFrequency) {
      recurrencePatch = {
        recurrenceFrequency: null,
        recurrenceActive: false,
        recurrenceEndsAt: null,
        recurrenceMaxOccurrences: null,
        // Keep seriesId/index for history linkage on past DONE rows; clear on this card if stopping.
        recurrenceSeriesId: existing.recurrenceSeriesId,
        recurrenceIndex: existing.recurrenceIndex,
      };
    } else if (existing.recurrenceSeriesId && existing.recurrenceFrequency) {
      recurrencePatch = {
        recurrenceFrequency: recurrence.recurrenceFrequency,
        recurrenceEndsAt: recurrence.recurrenceEndsAt,
        recurrenceMaxOccurrences: recurrence.recurrenceMaxOccurrences,
        recurrenceActive: becomingCancelled ? false : true,
        recurrenceSeriesId: existing.recurrenceSeriesId,
        recurrenceIndex: existing.recurrenceIndex ?? 0,
      };
    } else {
      recurrencePatch = {
        recurrenceFrequency: recurrence.recurrenceFrequency,
        recurrenceEndsAt: recurrence.recurrenceEndsAt,
        recurrenceMaxOccurrences: recurrence.recurrenceMaxOccurrences,
        recurrenceActive: becomingCancelled ? false : true,
        recurrenceSeriesId: crypto.randomUUID(),
        recurrenceIndex: 0,
      };
    }
  } else if (becomingCancelled && existing.recurrenceActive) {
    recurrencePatch = { recurrenceActive: false };
  }

  const spawnFrom: (SpawnableWorkTask & { id: string; status: WorkTaskStatus }) | null =
    becomingDone &&
    (Boolean(recurrencePatch.recurrenceActive) ||
      (!recurrenceInputProvided && existing.recurrenceActive))
      ? {
          id: existing.id,
          title: parsed.data.title,
          description: parsed.data.description || null,
          priority: parsed.data.priority ?? existing.priority,
          spaceId: parsed.data.spaceId || null,
          projectId: parsed.data.projectId || null,
          assigneeUserId: nextAssigneeUserId,
          createdByUserId: existing.createdByUserId,
          dueDate: parsed.data.dueDate ? parseOptionalDate(parsed.data.dueDate) : null,
          sprintLabel: parsed.data.sprintLabel || null,
          linkedEntityType: existing.linkedEntityType,
          linkedEntityId: existing.linkedEntityId,
          recurrenceFrequency:
            (recurrencePatch.recurrenceFrequency as WorkTaskRecurrenceFrequency | null | undefined) ??
            (existing.recurrenceFrequency as WorkTaskRecurrenceFrequency | null),
          recurrenceSeriesId:
            (recurrencePatch.recurrenceSeriesId as string | null | undefined) ??
            existing.recurrenceSeriesId,
          recurrenceIndex:
            (recurrencePatch.recurrenceIndex as number | null | undefined) ?? existing.recurrenceIndex,
          recurrenceEndsAt:
            (recurrencePatch.recurrenceEndsAt as Date | null | undefined) ?? existing.recurrenceEndsAt,
          recurrenceMaxOccurrences:
            (recurrencePatch.recurrenceMaxOccurrences as number | null | undefined) ??
            existing.recurrenceMaxOccurrences,
          recurrenceActive: true,
          status: nextStatus,
        }
      : null;

  if (becomingDone && spawnFrom) {
    recurrencePatch = { ...recurrencePatch, recurrenceActive: false };
  } else if (becomingCancelled && existing.recurrenceActive) {
    recurrencePatch = { ...recurrencePatch, recurrenceActive: false };
  }

  await prisma.workTask.update({
    where: { id: parsed.data.taskId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      status: nextStatus,
      priority: parsed.data.priority ?? "MEDIUM",
      spaceId: parsed.data.spaceId || null,
      projectId: parsed.data.projectId || null,
      assigneeUserId: nextAssigneeUserId,
      dueDate: parsed.data.dueDate ? parseOptionalDate(parsed.data.dueDate) : null,
      sprintLabel: parsed.data.sprintLabel || null,
      completedAt: nextStatus === WorkTaskStatus.DONE ? new Date() : null,
      ...recurrencePatch,
    },
  });

  if (spawnFrom) {
    await spawnNextIfNeeded(ctx.tenant.id, spawnFrom);
  }

  if (assigneeChanged) {
    await notifyTaskAssignee({
      tenantSlug,
      tenantName: ctx.tenant.name,
      assignerLabel: ctx.session.user.name || ctx.session.user.email || "A teammate",
      assignerUserId: ctx.session.user.id,
      assigneeUserId: nextAssigneeUserId,
      taskTitle: parsed.data.title,
      taskDescription: parsed.data.description,
      dueDate: parsed.data.dueDate,
      priority: parsed.data.priority ?? "MEDIUM",
    });
  }

  revalidatePath(`/${tenantSlug}/tasks`);
  return { ok: true };
}

export async function stopWorkTaskRecurrence(
  tenantSlug: string,
  taskId: string,
): Promise<ActionResult> {
  const ctx = await getTenantContext(tenantSlug);
  if (!ctx) return { ok: false, error: "You do not have access." };

  const parsed = stopWorkTaskRecurrenceInputSchema.safeParse({ taskId });
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  const existing = await prisma.workTask.findFirst({
    where: { id: parsed.data.taskId, tenantId: ctx.tenant.id },
    select: {
      id: true,
      createdByUserId: true,
      assigneeUserId: true,
      recurrenceActive: true,
      recurrenceFrequency: true,
    },
  });
  if (!existing) return { ok: false, error: "Task not found." };
  const accessError = await assertCanAccessTask(ctx, existing);
  if (accessError) return accessError;

  if (!existing.recurrenceFrequency || !existing.recurrenceActive) {
    return { ok: false, error: "This task is not an active repeating series." };
  }

  await prisma.workTask.update({
    where: { id: existing.id },
    data: { recurrenceActive: false },
  });

  revalidatePath(`/${tenantSlug}/tasks`);
  return { ok: true };
}

export async function deleteWorkTask(
  tenantSlug: string,
  taskId: string,
  scope: "THIS" | "SERIES" = "THIS",
): Promise<ActionResult> {
  const ctx = await getTenantContext(tenantSlug);
  if (!ctx) return { ok: false, error: "You do not have access." };

  const parsed = deleteWorkTaskInputSchema.safeParse({ taskId, scope });
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  const existing = await prisma.workTask.findFirst({
    where: { id: parsed.data.taskId, tenantId: ctx.tenant.id },
    select: {
      id: true,
      createdByUserId: true,
      assigneeUserId: true,
      recurrenceSeriesId: true,
      recurrenceActive: true,
      status: true,
    },
  });
  if (!existing) return { ok: false, error: "Task not found." };
  const accessError = await assertCanAccessTask(ctx, existing);
  if (accessError) return accessError;

  const isOwner =
    existing.createdByUserId === ctx.session.user.id || existing.assigneeUserId === ctx.session.user.id;
  const isAdmin =
    Boolean(ctx.session.user.isPlatformAdmin) ||
    ctx.membership?.role === "ORG_ADMIN" ||
    ctx.membership?.role === "SUB_ADMIN" ||
    ctx.membership?.role === "HR_MANAGER";
  const isDeptLead = Boolean(ctx.membership?.isDepartmentLead);
  if (!isOwner && !isAdmin && !isDeptLead) {
    return { ok: false, error: "You cannot delete this task." };
  }

  // SERIES: remove this active occurrence; completed history stays. No further spawns.
  // THIS: same for a recurring head (deleting the only open card ends the series).
  await prisma.workTask.delete({ where: { id: existing.id } });

  if (
    parsed.data.scope === "SERIES" &&
    existing.recurrenceSeriesId &&
    existing.status !== WorkTaskStatus.DONE &&
    existing.status !== WorkTaskStatus.CANCELLED
  ) {
    // Ensure no other incomplete heads remain active (defensive).
    await prisma.workTask.updateMany({
      where: {
        tenantId: ctx.tenant.id,
        recurrenceSeriesId: existing.recurrenceSeriesId,
        status: { notIn: [WorkTaskStatus.DONE, WorkTaskStatus.CANCELLED] },
      },
      data: { recurrenceActive: false },
    });
  }

  revalidatePath(`/${tenantSlug}/tasks`);
  return { ok: true };
}

export async function ensureDefaultTaskSpaces(tenantId: string) {
  const count = await prisma.taskSpace.count({ where: { tenantId } });
  if (count > 0) return;

  const defaults = [
    { name: "Company HQ", slug: "company-hq", color: "#6366f1", sortOrder: 0, isDefault: true },
    { name: "Product", slug: "product", color: "#f59e0b", sortOrder: 1, isDefault: false },
    { name: "Engineering", slug: "engineering", color: "#10b981", sortOrder: 2, isDefault: false },
    { name: "People", slug: "people", color: "#ec4899", sortOrder: 3, isDefault: false },
  ];

  await prisma.taskSpace.createMany({
    data: defaults.map((d) => ({ tenantId, ...d })),
  });
}

function slugifySpaceName(name: string) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "teamspace";
}

export async function createTaskSpace(
  tenantSlug: string,
  input: { name: string; color?: string },
): Promise<ActionResult & { spaceId?: string }> {
  const ctx = await getTenantContext(tenantSlug);
  if (!ctx) return { ok: false, error: "You do not have access." };
  if (!canManageTasks(Boolean(ctx.session.user.isPlatformAdmin), ctx.membership)) {
    return { ok: false, error: "Only managers and admins can add teamspaces." };
  }

  const parsed = createTaskSpaceInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  let slug = slugifySpaceName(parsed.data.name);
  const taken = await prisma.taskSpace.findFirst({
    where: { tenantId: ctx.tenant.id, slug },
    select: { id: true },
  });
  if (taken) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const maxOrder = await prisma.taskSpace.aggregate({
    where: { tenantId: ctx.tenant.id },
    _max: { sortOrder: true },
  });

  const created = await prisma.taskSpace.create({
    data: {
      tenantId: ctx.tenant.id,
      name: parsed.data.name,
      slug,
      color: parsed.data.color || "#6366f1",
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  revalidatePath(`/${tenantSlug}/tasks`);
  return { ok: true, spaceId: created.id };
}
