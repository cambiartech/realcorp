import { auth } from "@/auth";
import { CampaignStatus, MembershipRole, MembershipStatus } from "@/generated/prisma";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { MarketingWorkspace } from "./marketing-workspace";

export const dynamic = "force-dynamic";

function canManageMarketing(role: MembershipRole | undefined, isPlatformAdmin: boolean) {
  return isPlatformAdmin || role === MembershipRole.ORG_ADMIN || role === MembershipRole.MARKETING_MANAGER;
}

export default async function MarketingPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      slug: true,
      name: true,
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
    select: { status: true, role: true },
  });
  assertTenantNavAccess(session, membership, tenant.settings, "marketing");
  const canEdit =
    membership?.status === MembershipStatus.ACTIVE &&
    canManageMarketing(membership.role, Boolean(session.user.isPlatformAdmin));

  const [campaigns, totalLeads, attributedLeads, realtorLeads] = await Promise.all([
    prisma.campaign.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { leads: true } } },
      take: 200,
    }),
    prisma.lead.count({ where: { tenantId: tenant.id } }),
    prisma.lead.count({ where: { tenantId: tenant.id, campaignId: { not: null } } }),
    prisma.lead.count({ where: { tenantId: tenant.id, realtorPartnerId: { not: null } } }),
  ]);

  const attribution = await prisma.lead.groupBy({
    by: ["campaignId"],
    where: { tenantId: tenant.id, campaignId: { not: null } },
    _count: { _all: true },
  });
  const campaignIds = attribution.map((a) => a.campaignId).filter(Boolean) as string[];
  const campaignLabels = await prisma.campaign.findMany({
    where: { id: { in: campaignIds } },
    select: { id: true, name: true, code: true },
  });
  const labelMap = new Map(campaignLabels.map((c) => [c.id, `${c.name} (${c.code})`]));

  const activeCampaigns = campaigns.filter((c) => c.status === CampaignStatus.ACTIVE).length;

  return (
    <MarketingWorkspace
      tenantSlug={tenant.slug}
      tenantName={tenant.name}
      canEdit={canEdit}
      campaigns={campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        status: c.status,
        description: c.description,
        leadCount: c._count.leads,
        createdAt: c.createdAt.toISOString().slice(0, 10),
      }))}
      attributionRows={attribution
        .filter((row) => row.campaignId)
        .map((row) => ({
          label: labelMap.get(row.campaignId!) ?? row.campaignId!,
          count: row._count._all,
        }))}
      summary={{
        totalLeads,
        attributedLeads,
        realtorLeads,
        activeCampaigns,
        attributionRatePct: totalLeads > 0 ? Math.round((attributedLeads / totalLeads) * 100) : 0,
      }}
    />
  );
}
