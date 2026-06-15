import { auth } from "@/auth";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import {
  loadInvestorOrganizations,
  loadPortalDiscoverListings,
  loadStakeholderPortfolio,
} from "@/lib/portal";
import { loadPublicListingBrand } from "@/lib/public-listings";
import { notFound } from "next/navigation";
import { PortalWorkspace } from "./portal-workspace";

export const dynamic = "force-dynamic";

export default async function StakeholderPortalPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      name: true,
      slug: true,
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
    select: { role: true, status: true },
  });

  const isAdminViewer =
    Boolean(session.user.isPlatformAdmin) || membership?.role === "ORG_ADMIN";
  if (!isAdminViewer) {
    assertTenantNavAccess(session, membership, tenant.settings, "portal");
  }

  const [portfolio, discoverListings, allOrganizations, brand] = await Promise.all([
    loadStakeholderPortfolio(tenant.id, session.user.id),
    loadPortalDiscoverListings(tenant.slug, session.user.id),
    loadInvestorOrganizations(session.user.id),
    loadPublicListingBrand(tenant.slug),
  ]);

  return (
    <PortalWorkspace
      tenantSlug={tenant.slug}
      tenantName={tenant.name}
      userName={session.user.name ?? null}
      portfolio={portfolio}
      discoverListings={discoverListings}
      allOrganizations={allOrganizations}
      accentColor={brand?.accentColor ?? null}
      isAdminViewer={isAdminViewer && portfolio.projects.length === 0}
    />
  );
}
