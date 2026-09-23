import { auth } from "@/auth";
import { MembershipRole } from "@/generated/prisma";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";
import { canManageTasks, canViewAllOrgTasks, workTaskVisibilityWhere } from "@/lib/tasks-access";
import { filterTaskAssigneeMembers, type TaskAssigneeMember } from "@/lib/membership-departments";
import { loadManageeUserIds } from "@/lib/employee-task-managers";
import { profileFromMembershipRole, mapOrgDepartmentToAccess } from "@/lib/org-membership-profile";
import { capturePlatformErrorEvent } from "@/lib/platform-error-capture";
import { ensureDefaultTaskSpaces } from "./actions";

export const dynamic = "force-dynamic";

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function safeDateLabel(value: Date | string | null | undefined) {
  const date = asDate(value);
  if (!date) return null;
  try {
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function safeDateValue(value: Date | string | null | undefined) {
  return asDate(value)?.toISOString().slice(0, 10) ?? null;
}

export default async function TasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { tenantSlug } = await params;
  const { view } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      settings: {
        select: {
          moduleSales: true,
          moduleFinance: true,
          moduleMarketing: true,
          moduleCommunity: true,
          moduleShortLets: true,
          moduleHr: true,
          moduleTasks: true,
          roleModuleGrants: true,
        },
      },
    },
  });
  if (!tenant) notFound();

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true, status: true, department: true, isDepartmentLead: true, modulePermissions: true },
  });

  assertTenantNavAccess(session, membership, tenant.settings, "tasks");

  try {
  await ensureDefaultTaskSpaces(tenant.id);

  const memberships = await prisma.membership.findMany({
    where: { tenantId: tenant.id, status: "ACTIVE" },
    include: { user: { select: { id: true, name: true, email: true } } },
    take: 200,
  });

  const allMembers: TaskAssigneeMember[] = memberships.map((m) => ({
    id: m.user.id,
    label: m.user.name || m.user.email || "Member",
    role: m.role,
    department: m.department,
    isDepartmentLead: m.isDepartmentLead,
  }));

  const isPlatformAdmin = Boolean(session.user.isPlatformAdmin);
  const seesAllOrgTasks = canViewAllOrgTasks(isPlatformAdmin, membership);
  const taskWhere = workTaskVisibilityWhere({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    isPlatformAdmin,
    membership,
    members: allMembers,
  });

  const [spaces, projects, tasksResult] = await Promise.all([
    prisma.taskSpace.findMany({
      where: { tenantId: tenant.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true, color: true },
    }),
    prisma.taskProject.findMany({
      where: { tenantId: tenant.id, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, spaceId: true, sprintLabel: true, iconEmoji: true },
    }),
    prisma.workTask
      .findMany({
        where: taskWhere,
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        include: {
          space: { select: { name: true, color: true } },
          project: { select: { name: true, iconEmoji: true } },
        },
        take: 500,
      })
      .then((rows) => ({ ok: true as const, rows }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[tasks] workTask.findMany failed", message);
        return { ok: false as const, message };
      }),
  ]);

  const tasksLoadError =
    tasksResult.ok
      ? null
      : /recurrence|column .* does not exist|WorkTaskRecurrenceFrequency/i.test(tasksResult.message)
        ? "Tasks need a quick database update (recurring tasks migration). Ask a platform admin to redeploy or run prisma migrate deploy, then refresh."
        : "Could not load tasks right now. Try again in a moment.";
  const tasks = tasksResult.ok ? tasksResult.rows : [];

  const memberById = new Map(allMembers.map((m) => [m.id, m]));
  const missingCreatorIds = [
    ...new Set(
      tasks
        .map((t) => t.createdByUserId)
        .filter((id): id is string => Boolean(id) && !memberById.has(id)),
    ),
  ];
  let extraCreators: Array<{ id: string; name: string | null; email: string | null }> = [];
  if (missingCreatorIds.length > 0) {
    try {
      extraCreators = await prisma.user.findMany({
        where: { id: { in: missingCreatorIds } },
        select: { id: true, name: true, email: true },
      });
    } catch (error) {
      console.error("[tasks] assignor lookup failed", error);
    }
  }
  const creatorLabelById = new Map<string, string>(
    allMembers.map((m) => [m.id, m.label]),
  );
  for (const user of extraCreators) {
    creatorLabelById.set(user.id, user.name || user.email || "Assignor");
  }
  const manageeUserIds = await loadManageeUserIds(tenant.id, session.user.id);
  const memberOptions = filterTaskAssigneeMembers(allMembers, {
    isPlatformAdmin,
    actorRole: membership?.role,
    actorUserId: session.user.id,
    actorDepartment: membership?.department,
    actorIsDepartmentLead: membership?.isDepartmentLead,
    manageeUserIds,
  });

  const initialView =
    view === "my"
      ? "my"
      : view === "sprint"
        ? "sprint"
        : view === "history"
          ? "history"
          : view === "company"
            ? "company"
            : seesAllOrgTasks || membership?.isDepartmentLead
              ? "company"
              : "my";
  const department =
    (membership?.department ? mapOrgDepartmentToAccess(membership.department) : null) ??
    profileFromMembershipRole(membership?.role ?? MembershipRole.SALES_EXECUTIVE).department;

  return (
    <TasksWorkspace
      tenantSlug={tenantSlug}
      currentUserId={session.user.id}
      department={department}
      canViewAllOrgTasks={seesAllOrgTasks}
      isDepartmentLead={Boolean(membership?.isDepartmentLead)}
      loadError={tasksLoadError}
      spaces={spaces.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        color: s.color || "#6366f1",
      }))}
      projects={projects.map((p) => ({
        id: p.id,
        name: p.name,
        spaceId: p.spaceId,
        sprintLabel: p.sprintLabel,
        iconEmoji: p.iconEmoji,
      }))}
      tasks={tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        spaceId: t.spaceId,
        spaceName: t.space?.name || null,
        spaceColor: t.space?.color || null,
        projectId: t.projectId,
        projectName: t.project?.name || null,
        projectEmoji: t.project?.iconEmoji || null,
        sprintLabel: t.sprintLabel,
        assigneeUserId: t.assigneeUserId,
        createdByUserId: t.createdByUserId,
        assigneeLabel: t.assigneeUserId
          ? memberById.get(t.assigneeUserId)?.label || "Assigned"
          : "Unassigned",
        createdByLabel: creatorLabelById.get(t.createdByUserId) || "Assignor",
        dueDateLabel: safeDateLabel(t.dueDate),
        dueDateValue: safeDateValue(t.dueDate),
        completedAt: asDate(t.completedAt)?.toISOString() ?? null,
        completedAtLabel: safeDateLabel(t.completedAt),
        linkedEntityType: t.linkedEntityType,
        recurrenceFrequency: t.recurrenceFrequency ?? null,
        recurrenceActive: Boolean(t.recurrenceActive),
        recurrenceEndsAtValue: safeDateValue(t.recurrenceEndsAt),
        recurrenceMaxOccurrences: t.recurrenceMaxOccurrences ?? null,
      }))}
      members={memberOptions}
      canManageSpaces={canManageTasks(isPlatformAdmin, membership)}
      initialView={initialView}
    />
  );
  } catch (error) {
    const digest = typeof error === "object" && error && "digest" in error ? String((error as { digest?: string }).digest || "") : "";
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") || digest.includes("NEXT_NOT_FOUND")) {
      throw error;
    }
    const reference = digest || `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const message = error instanceof Error ? error.message : String(error);
    console.error("[tasks] page failed", reference, error);
    try {
      await capturePlatformErrorEvent({
        digest: reference,
        name: error instanceof Error ? error.name : "Error",
        message,
        stack: error instanceof Error ? error.stack : null,
        routePath: `/${tenantSlug}/tasks`,
        tenantSlug,
        metadata: { source: "tasks-page" },
      });
    } catch (captureError) {
      console.error("[tasks] error capture failed", captureError);
    }
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-lg font-semibold text-foreground">Tasks could not load</h1>
        <p className="mt-2 text-sm text-muted">
          Refresh the page. If this stays, send this reference to a platform admin.
        </p>
        <p className="mt-4 text-sm font-semibold text-foreground">
          Error reference{" "}
          <code className="rounded-md border border-foreground/20 bg-field px-2 py-1 font-mono text-base">
            {reference}
          </code>
        </p>
      </div>
    );
  }
}
