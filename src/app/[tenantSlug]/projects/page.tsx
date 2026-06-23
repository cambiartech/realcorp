import { auth } from "@/auth";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { resolveTenantCurrencies } from "@/lib/finance-catalog";
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
      name: true,
      defaultCurrency: true,
      settings: {
        select: {
          moduleSales: true,
          moduleFinance: true,
          moduleMarketing: true,
          moduleCommunity: true,
          moduleListings: true,
          moduleInvestorPortal: true,
          roleModuleGrants: true,
          financeCurrencies: true,
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

  const [projects, stakeholders, portalMembers] = await Promise.all([
    prisma.project.findMany({
      where: { tenantId: tenant.id, ...(projectId ? { id: projectId } : {}) },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { units: true } },
      },
      take: 200,
    }),
    prisma.projectStakeholder.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        projectId: true,
        userId: true,
        type: true,
        sharePercent: true,
        investmentAmount: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.membership.findMany({
      where: {
        tenantId: tenant.id,
        status: MembershipStatus.ACTIVE,
        role: { in: [MembershipRole.INVESTOR, MembershipRole.LISTING_OWNER] },
      },
      select: {
        userId: true,
        role: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const currencies = resolveTenantCurrencies(tenant.settings, tenant.defaultCurrency);

  return (
    <ProjectsWorkspace
      tenantSlug={tenant.slug}
      tenantName={tenant.name}
      canManage={canManage}
      listingsEnabled={tenant.settings?.moduleListings !== false}
      portalEnabled={tenant.settings?.moduleInvestorPortal === true}
      currencies={currencies}
      defaultCurrency={tenant.defaultCurrency || currencies[0] || "NGN"}
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
        isPublished: project.isPublished,
        listingDescription: project.listingDescription,
        locationCity: project.locationCity,
        locationState: project.locationState,
        locationAddress: project.locationAddress,
        coverImageUrl: project.coverImageUrl,
        galleryUrls: Array.isArray(project.galleryUrls)
          ? (project.galleryUrls as string[]).filter((u): u is string => typeof u === "string")
          : [],
        amenities: Array.isArray(project.amenities)
          ? (project.amenities as string[]).filter((a): a is string => typeof a === "string")
          : [],
      }))}
      stakeholders={stakeholders.map((s) => ({
        id: s.id,
        projectId: s.projectId,
        userId: s.userId,
        type: s.type,
        sharePercent: Number(s.sharePercent),
        investmentAmount: s.investmentAmount != null ? Number(s.investmentAmount) : null,
        label: s.user.name || s.user.email || "Member",
      }))}
      portalMembers={portalMembers.map((m) => ({
        userId: m.userId,
        role: m.role as "INVESTOR" | "LISTING_OWNER",
        label: m.user.name || m.user.email || "Member",
      }))}
    />
  );
}
