import type { WorkTaskStatus } from "../../src/generated/prisma";
import type { DemoSeedContext } from "./types";

const SPRINT = "Sprint 12";

export async function seedTasks(ctx: DemoSeedContext) {
  const { prisma, tenantId, users } = ctx;
  console.log("  [tasks] teamspaces, roadmap project, kanban tasks…");

  const demoExists = await prisma.workTask.findFirst({
    where: { tenantId, sprintLabel: SPRINT },
    select: { id: true },
  });
  if (demoExists) return;

  let spaces = await prisma.taskSpace.findMany({ where: { tenantId }, orderBy: { sortOrder: "asc" } });
  if (spaces.length === 0) {
    spaces = await Promise.all(
      [
        { name: "Company HQ", slug: "company-hq", color: "#6366f1", sortOrder: 0, isDefault: true },
        { name: "Product", slug: "product", color: "#f59e0b", sortOrder: 1, isDefault: false },
        { name: "Engineering", slug: "engineering", color: "#10b981", sortOrder: 2, isDefault: false },
        { name: "People", slug: "people", color: "#ec4899", sortOrder: 3, isDefault: false },
      ].map((s) =>
        prisma.taskSpace.create({
          data: { tenantId, ...s },
        }),
      ),
    );
  }

  const bySlug = Object.fromEntries(spaces.map((s) => [s.slug, s]));
  // Ensure required slugs exist even if defaults were partially created
  for (const spec of [
    { name: "Company HQ", slug: "company-hq", color: "#6366f1", sortOrder: 0, isDefault: true },
    { name: "Product", slug: "product", color: "#f59e0b", sortOrder: 1, isDefault: false },
    { name: "Engineering", slug: "engineering", color: "#10b981", sortOrder: 2, isDefault: false },
    { name: "People", slug: "people", color: "#ec4899", sortOrder: 3, isDefault: false },
  ]) {
    if (!bySlug[spec.slug]) {
      const created = await prisma.taskSpace.create({ data: { tenantId, ...spec } });
      bySlug[spec.slug] = created;
    }
  }

  const roadmap = await prisma.taskProject.create({
    data: {
      tenantId,
      spaceId: bySlug.product.id,
      name: "Q2 Product Roadmap",
      description: "Launch readiness and customer-facing improvements",
      sprintLabel: SPRINT,
      iconEmoji: "🚀",
    },
  });

  const appraisalProject = await prisma.taskProject.create({
    data: {
      tenantId,
      spaceId: bySlug.people.id,
      name: "Mid-year appraisals 2026",
      description: "Manager reviews and employee self-assessments",
      iconEmoji: "📋",
    },
  });

  const assignees = [users.orgAdmin, users.salesUser, users.financeUser, users.hrUser].filter(Boolean);
  const pickAssignee = (i: number) => assignees[i % assignees.length]?.id || users.orgAdmin.id;

  const taskRows: Array<{
    title: string;
    status: WorkTaskStatus;
    spaceSlug: string;
    projectId?: string;
    sprint?: boolean;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    linked?: boolean;
  }> = [
    { title: "Update help center and office documentation", status: "TODO", spaceSlug: "company-hq", priority: "MEDIUM" },
    { title: "Review campaign assets for Azure launch", status: "TODO", spaceSlug: "product", projectId: roadmap.id, sprint: true, priority: "HIGH" },
    { title: "Customer stories — collect 3 case studies", status: "TODO", spaceSlug: "product", projectId: roadmap.id, priority: "MEDIUM" },
    { title: "Finalize Q2 OKR alignment deck", status: "TODO", spaceSlug: "company-hq", priority: "HIGH" },
    { title: "Sales demo sync — product + sales", status: "IN_PROGRESS", spaceSlug: "product", projectId: roadmap.id, sprint: true, priority: "URGENT" },
    { title: "Launch demo video — first cut", status: "IN_PROGRESS", spaceSlug: "product", projectId: roadmap.id, sprint: true, priority: "HIGH" },
    { title: "Engineering handoff checklist", status: "IN_PROGRESS", spaceSlug: "engineering", priority: "MEDIUM" },
    { title: "Weekly sales status report template", status: "IN_REVIEW", spaceSlug: "company-hq", priority: "MEDIUM" },
    { title: "Marketing campaign designs — brand review", status: "IN_REVIEW", spaceSlug: "product", sprint: true, priority: "MEDIUM" },
    { title: "HR: Complete mid-year self-assessment", status: "TODO", spaceSlug: "people", projectId: appraisalProject.id, linked: true, priority: "HIGH" },
    { title: "HR: Schedule manager 1:1 reviews", status: "IN_PROGRESS", spaceSlug: "people", projectId: appraisalProject.id, linked: true, priority: "HIGH" },
    { title: "Project onboarding playbook", status: "DONE", spaceSlug: "company-hq", priority: "LOW" },
    { title: "Finalize launch timeline", status: "DONE", spaceSlug: "product", projectId: roadmap.id, sprint: true, priority: "MEDIUM" },
    { title: "Vendor contract renewal — legal sign-off", status: "DONE", spaceSlug: "company-hq", priority: "MEDIUM" },
  ];

  for (let i = 0; i < taskRows.length; i += 1) {
    const row = taskRows[i];
    const space = bySlug[row.spaceSlug] || bySlug["company-hq"];
    await prisma.workTask.create({
      data: {
        tenantId,
        spaceId: space.id,
        projectId: row.projectId || null,
        title: row.title,
        status: row.status,
        priority: row.priority || "MEDIUM",
        sprintLabel: row.sprint ? SPRINT : null,
        assigneeUserId: pickAssignee(i),
        createdByUserId: users.orgAdmin.id,
        completedAt: row.status === "DONE" ? new Date() : null,
        linkedEntityType: row.linked ? "HR_APPRAISAL" : null,
        linkedEntityId: row.linked ? "demo-appraisal-placeholder" : null,
      },
    });
  }

  await prisma.tenantSettings.updateMany({
    where: { tenantId },
    data: { moduleTasks: true },
  });
}
