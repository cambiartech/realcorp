import { auth } from "@/auth";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { loadInvestorClientDocuments } from "@/lib/portal";
import { notFound } from "next/navigation";
import { InvestorDocumentsWorkspace } from "./investor-documents-workspace";

export const dynamic = "force-dynamic";

export default async function InvestorDocumentsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
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

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true, status: true, modulePermissions: true },
  });

  const isAdminViewer = Boolean(session.user.isPlatformAdmin) || membership?.role === "ORG_ADMIN";
  if (!isAdminViewer) {
    assertTenantNavAccess(session, membership, tenant.settings, "portalDocuments");
  }

  const documents = await loadInvestorClientDocuments(tenant.id, session.user.id);

  return (
    <InvestorDocumentsWorkspace
      tenantSlug={tenantSlug}
      tenantName={tenant.name}
      documents={documents}
      isAdminViewer={isAdminViewer}
    />
  );
}
