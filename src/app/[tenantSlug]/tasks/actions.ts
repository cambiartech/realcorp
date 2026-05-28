"use server";

import { auth } from "@/auth";
import { WorkTaskStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import { canManageTasks, canViewTasksModule } from "@/lib/tasks-access";
import {
  createWorkTaskInputSchema,
  createTaskSpaceInputSchema,
  updateWorkTaskInputSchema,
  updateWorkTaskStatusInputSchema,
} from "@/lib/validators/tasks";
import { revalidatePath } from "next/cache";

type ActionResult = { ok: true } | { ok: false; error: string };

async function getTenantContext(tenantSlug: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, settings: { select: { moduleTasks: true } } },
  });
  if (!tenant) return null;

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { status: true, role: true },
  });

  const moduleTasks = tenant.settings?.moduleTasks ?? true;
  if (
    !canViewTasksModule(Boolean(session.user.isPlatformAdmin), membership, moduleTasks)
  ) {
    return null;
  }

  return { tenant, session, membership };
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
  },
): Promise<ActionResult & { taskId?: string }> {
  const ctx = await getTenantContext(tenantSlug);
  if (!ctx) return { ok: false, error: "You do not have access." };

  const parsed = createWorkTaskInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  const status = parsed.data.status ?? WorkTaskStatus.TODO;
  const completedAt = status === WorkTaskStatus.DONE ? new Date() : null;

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
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      sprintLabel: parsed.data.sprintLabel || null,
      completedAt,
      createdByUserId: ctx.session.user.id,
    },
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
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "Task not found." };

  await prisma.workTask.update({
    where: { id: taskId },
    data: {
      status: parsed.data.status,
      completedAt: parsed.data.status === WorkTaskStatus.DONE ? new Date() : null,
    },
  });

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
  },
): Promise<ActionResult> {
  const ctx = await getTenantContext(tenantSlug);
  if (!ctx) return { ok: false, error: "You do not have access." };

  const parsed = updateWorkTaskInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  const existing = await prisma.workTask.findFirst({
    where: { id: parsed.data.taskId, tenantId: ctx.tenant.id },
    select: { id: true, createdByUserId: true, assigneeUserId: true, status: true },
  });
  if (!existing) return { ok: false, error: "Task not found." };

  const isOwner =
    existing.createdByUserId === ctx.session.user.id ||
    existing.assigneeUserId === ctx.session.user.id;
  const isAdmin = Boolean(ctx.session.user.isPlatformAdmin) || ctx.membership?.role === "ORG_ADMIN";
  if (!isOwner && !isAdmin && !canManageTasks(Boolean(ctx.session.user.isPlatformAdmin), ctx.membership)) {
    return { ok: false, error: "You cannot edit this task." };
  }

  const nextStatus = parsed.data.status ?? existing.status;

  await prisma.workTask.update({
    where: { id: parsed.data.taskId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      status: nextStatus,
      priority: parsed.data.priority ?? "MEDIUM",
      spaceId: parsed.data.spaceId || null,
      projectId: parsed.data.projectId || null,
      assigneeUserId: parsed.data.assigneeUserId || null,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      sprintLabel: parsed.data.sprintLabel || null,
      completedAt: nextStatus === WorkTaskStatus.DONE ? new Date() : null,
    },
  });

  revalidatePath(`/${tenantSlug}/tasks`);
  return { ok: true };
}

export async function deleteWorkTask(tenantSlug: string, taskId: string): Promise<ActionResult> {
  const ctx = await getTenantContext(tenantSlug);
  if (!ctx) return { ok: false, error: "You do not have access." };

  const existing = await prisma.workTask.findFirst({
    where: { id: taskId, tenantId: ctx.tenant.id },
    select: { id: true, createdByUserId: true, assigneeUserId: true },
  });
  if (!existing) return { ok: false, error: "Task not found." };

  const isOwner =
    existing.createdByUserId === ctx.session.user.id ||
    existing.assigneeUserId === ctx.session.user.id;
  const isAdmin = Boolean(ctx.session.user.isPlatformAdmin) || ctx.membership?.role === "ORG_ADMIN";
  if (!isOwner && !isAdmin) return { ok: false, error: "You cannot delete this task." };

  await prisma.workTask.delete({ where: { id: taskId } });
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
