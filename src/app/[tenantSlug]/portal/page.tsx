import { auth } from "@/auth";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import {
  loadInvestorOrganizations,
  loadInvestorShortletPortfolio,
  loadPortalDiscoverListings,
  loadStakeholderPortfolio,
} from "@/lib/portal";
import { loadPublicListingBrand } from "@/lib/public-listings";
import { notFound } from "next/navigation";
import { PortalWorkspace } from "./portal-workspace";

export const dynamic = "force-dynamic";

export default async function StakeholderPortalPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
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

  const isAdminViewer = Boolean(session.user.isPlatformAdmin) || membership?.role === "ORG_ADMIN";
  if (!isAdminViewer) {
    assertTenantNavAccess(session, membership, tenant.settings, "portal");
  }

  const [portfolio, shortletPortfolio, discoverListings, allOrganizations, brand, investorContact] =
    await Promise.all([
      loadStakeholderPortfolio(tenant.id, session.user.id),
      tenant.settings?.moduleShortLets
        ? loadInvestorShortletPortfolio(tenant.id, session.user.id)
        : Promise.resolve({ units: [], totals: { currency: "NGN", collected: 0, earnings: 0, units: 0 } }),
      loadPortalDiscoverListings(tenant.slug, session.user.id),
      loadInvestorOrganizations(session.user.id),
      loadPublicListingBrand(tenant.slug),
      prisma.propertyClient.findFirst({
        where: { tenantId: tenant.id, userId: session.user.id },
        select: { fullName: true, email: true, phone: true, alternatePhone: true },
      }),
    ]);

  const contact = {
    name: investorContact?.fullName || session.user.name || session.user.email?.split("@")[0] || "Investor",
    email: session.user.email || investorContact?.email || "",
    phone: investorContact?.phone || investorContact?.alternatePhone || null,
  };

  return (
    <PortalWorkspace
      tenantSlug={tenant.slug}
      tenantName={tenant.name}
      userName={session.user.name ?? null}
      investorContact={contact}
      portfolio={portfolio}
      shortletPortfolio={shortletPortfolio}
      showShortlets={Boolean(tenant.settings?.moduleShortLets)}
      discoverListings={discoverListings}
      allOrganizations={allOrganizations}
      accentColor={brand?.accentColor ?? null}
      isAdminViewer={isAdminViewer && portfolio.projects.length === 0}
    />
  );
}
