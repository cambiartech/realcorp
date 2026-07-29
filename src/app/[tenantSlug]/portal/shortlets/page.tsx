import { auth } from "@/auth";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { loadInvestorShortletPortfolio } from "@/lib/portal";
import { notFound } from "next/navigation";
import { InvestorShortletsWorkspace } from "./investor-shortlets-workspace";

export const dynamic = "force-dynamic";

export default async function InvestorShortletsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
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

  assertTenantNavAccess(session, membership, tenant.settings, "portalShortlets");

  const portfolio = await loadInvestorShortletPortfolio(tenant.id, session.user.id);

  return (
    <InvestorShortletsWorkspace tenantSlug={tenantSlug} tenantName={tenant.name} portfolio={portfolio} />
  );
}
