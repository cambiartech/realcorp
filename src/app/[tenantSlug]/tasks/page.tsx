import { auth } from "@/auth";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";
import { canManageTasks } from "@/lib/tasks-access";
import { filterTaskAssigneeMembers, type TaskAssigneeMember } from "@/lib/membership-departments";
import { ensureDefaultTaskSpaces } from "./actions";

export const dynamic = "force-dynamic";

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
    select: { role: true, status: true, department: true, isDepartmentLead: true },
  });

  assertTenantNavAccess(session, membership, tenant.settings, "tasks");

  await ensureDefaultTaskSpaces(tenant.id);

  const [spaces, projects, tasks, memberships] = await Promise.all([
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
    prisma.workTask.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      include: {
        space: { select: { name: true, color: true } },
        project: { select: { name: true, iconEmoji: true } },
      },
      take: 500,
    }),
    prisma.membership.findMany({
      where: { tenantId: tenant.id, status: "ACTIVE" },
      include: { user: { select: { id: true, name: true, email: true } } },
      take: 200,
    }),
  ]);

  const allMembers: TaskAssigneeMember[] = memberships.map((m) => ({
    id: m.user.id,
    label: m.user.name || m.user.email || "Member",
    role: m.role,
    department: m.department,
    isDepartmentLead: m.isDepartmentLead,
  }));

  const memberOptions = filterTaskAssigneeMembers(allMembers, {
    isPlatformAdmin: Boolean(session.user.isPlatformAdmin),
    actorRole: membership?.role,
    actorUserId: session.user.id,
    actorDepartment: membership?.department,
    actorIsDepartmentLead: membership?.isDepartmentLead,
  });

  const initialView = view === "my" ? "my" : view === "sprint" ? "sprint" : "company";

  return (
    <TasksWorkspace
      tenantSlug={tenantSlug}
      currentUserId={session.user.id}
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
        assigneeLabel: t.assigneeUserId
          ? memberOptions.find((m) => m.id === t.assigneeUserId)?.label || "Assigned"
          : "Unassigned",
        dueDateLabel: t.dueDate
          ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(t.dueDate)
          : null,
        dueDateValue: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
        linkedEntityType: t.linkedEntityType,
      }))}
      members={memberOptions}
      canManageSpaces={canManageTasks(Boolean(session.user.isPlatformAdmin), membership)}
      initialView={initialView}
    />
  );
}
