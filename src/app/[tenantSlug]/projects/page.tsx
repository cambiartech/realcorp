import { auth } from "@/auth";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { ProjectsWorkspace } from "./projects-workspace";

export const dynamic = "force-dynamic";

export default async function TenantProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { tenantSlug } = await params;
  const { projectId } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      slug: true,
      settings: {
        select: {
          moduleSales: true,
          moduleFinance: true,
          moduleMarketing: true,
          moduleCommunity: true,
          roleModuleGrants: true,
        },
      },
    },
  });
  if (!tenant) notFound();

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true, status: true },
  });
  assertTenantNavAccess(session, membership, tenant.settings, "projects");
  const canManage =
    session.user.isPlatformAdmin ||
    (membership?.status === MembershipStatus.ACTIVE &&
      (membership.role === MembershipRole.ORG_ADMIN || membership.role === MembershipRole.SALES_MANAGER));

  const projects = await prisma.project.findMany({
    where: { tenantId: tenant.id, ...(projectId ? { id: projectId } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { units: true } },
    },
    take: 200,
  });

  return (
    <ProjectsWorkspace
      tenantSlug={tenant.slug}
      canManage={canManage}
      activeFilterChips={
        projectId
          ? [
              {
                label: `Project: ${projects[0]?.name || projectId}`,
                clearHref: `/${tenant.slug}/projects`,
              },
            ]
          : []
      }
      projects={projects.map((project) => ({
        id: project.id,
        name: project.name,
        unitsCount: project._count.units,
        createdAt: project.createdAt.toISOString().slice(0, 10),
        basePrice: project.basePrice ? Number(project.basePrice) : null,
        currency: project.currency,
      }))}
    />
  );
}
