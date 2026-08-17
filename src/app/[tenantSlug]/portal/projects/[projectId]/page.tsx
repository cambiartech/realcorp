import { auth } from "@/auth";
import { assertTenantNavAccess, MEMBERSHIP_FOR_NAV_SELECT } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { loadInvestorProjectDetail } from "@/lib/portal";
import { notFound } from "next/navigation";
import { InvestorProjectDetailWorkspace } from "./investor-project-detail-workspace";

export const dynamic = "force-dynamic";

export default async function InvestorProjectDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; projectId: string }>;
}) {
  const { tenantSlug, projectId } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      name: true,
      settings: {
        select: {
          moduleSales: true,
          moduleFinance: true,
          moduleMarketing: true,
          moduleCommunity: true,
          moduleShortLets: true,
          moduleHr: true,
          moduleTasks: true,
          moduleClients: true,
          moduleInvestorPortal: true,
          roleModuleGrants: true,
        },
      },
    },
  });
  if (!tenant) notFound();
  if (tenant.settings?.moduleInvestorPortal === false) notFound();

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: MEMBERSHIP_FOR_NAV_SELECT,
  });

  const isAdminViewer = Boolean(session.user.isPlatformAdmin) || membership?.role === "ORG_ADMIN";
  if (!isAdminViewer) {
    assertTenantNavAccess(session, membership, tenant.settings, "portal");
  }

  const project = await loadInvestorProjectDetail(tenant.id, session.user.id, projectId);
  if (!project) notFound();

  return (
    <InvestorProjectDetailWorkspace tenantSlug={tenantSlug} tenantName={tenant.name} project={project} />
  );
}
