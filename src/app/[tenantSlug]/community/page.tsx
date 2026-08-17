import { auth } from "@/auth";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import { assertTenantNavAccess, MEMBERSHIP_FOR_NAV_SELECT } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import {
  buildCommunityMemberLeaderboard,
  type CommunityLeaderboardPeriod,
} from "@/lib/community-leaderboard";
import { notFound } from "next/navigation";
import { CommunityWorkspace } from "./community-workspace";

export const dynamic = "force-dynamic";

function canManageCommunity(role: MembershipRole | undefined, isPlatformAdmin: boolean) {
  return (
    isPlatformAdmin ||
    role === MembershipRole.ORG_ADMIN ||
    role === MembershipRole.COMMUNITY_MANAGER ||
    role === MembershipRole.SALES_MANAGER
  );
}

export default async function CommunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ tab?: string; period?: string }>;
}) {
  const { tenantSlug } = await params;
  const { tab, period } = await searchParams;
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
    select: MEMBERSHIP_FOR_NAV_SELECT,
  });
  assertTenantNavAccess(session, membership, tenant.settings, "community");
  const canEdit =
    membership?.status === MembershipStatus.ACTIVE &&
    canManageCommunity(membership.role, Boolean(session.user.isPlatformAdmin));

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [partners, monthLeads, partnerLeads, partnerDeals] = await Promise.all([
    prisma.realtorPartner.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { leads: true } } },
      take: 200,
    }),
    prisma.lead.count({
      where: {
        tenantId: tenant.id,
        realtorPartnerId: { not: null },
        createdAt: { gte: monthStart },
      },
    }),
    prisma.lead.findMany({
      where: { tenantId: tenant.id, realtorPartnerId: { not: null } },
      select: {
        realtorPartnerId: true,
        source: true,
        quality: true,
        createdAt: true,
      },
      take: 5000,
    }),
    prisma.deal.findMany({
      where: {
        tenantId: tenant.id,
        lead: { realtorPartnerId: { not: null } },
      },
      select: {
        stage: true,
        value: true,
        updatedAt: true,
        lead: { select: { realtorPartnerId: true } },
      },
      take: 2000,
    }),
  ]);

  const activePartners = partners.filter((p) => p.isActive).length;
  const portalReady = partners.filter((p) => p.portalTokenHash).length;

  const leaderboardInput = {
    partners: partners.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      company: p.company,
      territory: p.territory,
      isActive: p.isActive,
    })),
    leads: partnerLeads,
    deals: partnerDeals,
  };

  const periods: CommunityLeaderboardPeriod[] = ["month", "quarter", "year"];
  const leaderboards = Object.fromEntries(
    periods.map((p) => [p, buildCommunityMemberLeaderboard({ ...leaderboardInput, period: p })]),
  ) as Record<CommunityLeaderboardPeriod, ReturnType<typeof buildCommunityMemberLeaderboard>>;

  const initialPeriod: CommunityLeaderboardPeriod =
    period === "quarter" || period === "year" ? period : "month";

  return (
    <CommunityWorkspace
      tenantSlug={tenant.slug}
      tenantName={tenant.name}
      currency={tenant.defaultCurrency}
      canEdit={canEdit}
      initialTab={tab === "leaderboard" ? "leaderboard" : "partners"}
      initialPeriod={initialPeriod}
      leaderboards={leaderboards}
      partners={partners.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        email: p.email,
        phone: p.phone,
        company: p.company,
        territory: p.territory,
        isActive: p.isActive,
        hasPortal: Boolean(p.portalTokenHash),
        leadCount: p._count.leads,
        createdAt: p.createdAt.toISOString().slice(0, 10),
      }))}
      summary={{
        totalPartners: partners.length,
        activePartners,
        portalReady,
        monthLeads,
      }}
    />
  );
}
