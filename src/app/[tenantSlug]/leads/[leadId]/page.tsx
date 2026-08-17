import { auth } from "@/auth";
import { CampaignStatus, MembershipRole, MembershipStatus } from "@/generated/prisma";
import { assertTenantNavAccess, MEMBERSHIP_FOR_NAV_SELECT } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { buildLeadSourceOptions } from "@/lib/lead-source-options";
import { formatEnumLabel } from "@/lib/ui-format";
import { notFound } from "next/navigation";
import { getActivitiesForEntity } from "@/app/[tenantSlug]/activities/actions";
import { LeadDetailWorkspace } from "./lead-detail-workspace";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; leadId: string }>;
}) {
  const { tenantSlug, leadId } = await params;
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
    select: MEMBERSHIP_FOR_NAV_SELECT,
  });
  assertTenantNavAccess(session, membership, tenant.settings, "leads");

  const canEdit =
    Boolean(session.user.isPlatformAdmin) ||
    (membership?.status === MembershipStatus.ACTIVE &&
      (membership.role === MembershipRole.ORG_ADMIN ||
        membership.role === MembershipRole.SALES_MANAGER ||
        membership.role === MembershipRole.SALES_EXECUTIVE));

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tenantId: tenant.id },
    include: {
      campaign: { select: { id: true, name: true, code: true } },
      realtorPartner: { select: { id: true, displayName: true } },
      deals: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          stage: true,
          value: true,
          assignedUserId: true,
          createdAt: true,
          unit: { select: { id: true, label: true, project: { select: { id: true, name: true } } } },
        },
      },
    },
  });
  if (!lead) notFound();

  const [users, projects, campaigns, rawActivities] = await Promise.all([
    prisma.membership.findMany({
      where: { tenantId: tenant.id, status: MembershipStatus.ACTIVE },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    prisma.project.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
      take: 300,
    }),
    prisma.campaign.findMany({
      where: {
        tenantId: tenant.id,
        status: { in: [CampaignStatus.ACTIVE, CampaignStatus.DRAFT, CampaignStatus.PAUSED] },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
      take: 200,
    }),
    getActivitiesForEntity(tenantSlug, "LEAD", leadId),
  ]);

  const whatsappMessages = await prisma.whatsAppMessage.findMany({
    where: { tenantId: tenant.id, leadId: lead.id },
    orderBy: { timestamp: "asc" },
    take: 100,
  });

  const userMap = new Map(users.map((m) => [m.userId, m.user]));
  const ownerUser = lead.assignedUserId ? userMap.get(lead.assignedUserId) : null;
  const sourceOptions = buildLeadSourceOptions([lead.source]);
  const userOptions = users.map((m) => ({ id: m.user.id, label: m.user.name ?? m.user.email ?? m.user.id }));
  const activities = rawActivities.map((a) => {
    const actor = userMap.get(a.createdByUserId);
    const assigned = a.assignedUserId ? userMap.get(a.assignedUserId) : null;
    return {
      id: a.id,
      type: a.type,
      status: a.status,
      title: a.title,
      body: a.body,
      dueAt: a.dueAt?.toISOString() ?? null,
      completedAt: a.completedAt?.toISOString() ?? null,
      createdByUserId: a.createdByUserId,
      assignedUserId: a.assignedUserId,
      createdAt: a.createdAt.toISOString(),
      actorLabel: actor?.name ?? actor?.email ?? "Unknown",
      assignedLabel: assigned?.name ?? assigned?.email ?? null,
    };
  });

  return (
    <LeadDetailWorkspace
      tenantSlug={tenant.slug}
      canEdit={canEdit}
      lead={{
        id: lead.id,
        name: lead.name ?? "Unnamed lead",
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
        campaignId: lead.campaignId,
        campaignName: lead.campaign?.name ?? lead.campaignName,
        projectInterest: lead.projectInterest,
        budgetRange: lead.budgetRange,
        quality: lead.quality,
        qualityLabel: formatEnumLabel(lead.quality),
        score: lead.score,
        lastActivityAt: lead.lastActivityAt?.toISOString().slice(0, 10) ?? null,
        assignedUserId: lead.assignedUserId,
        ownerLabel: ownerUser?.name ?? ownerUser?.email ?? (lead.assignedUserId ? "Unknown" : "Unassigned"),
        utmSource: lead.utmSource,
        utmMedium: lead.utmMedium,
        utmCampaign: lead.utmCampaign,
        utmContent: lead.utmContent,
        utmTerm: lead.utmTerm,
        notes: lead.notes,
        realtorPartnerName: lead.realtorPartner?.displayName ?? null,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
      }}
      deals={lead.deals.map((d) => ({
        id: d.id,
        stage: formatEnumLabel(d.stage),
        stageValue: d.stage,
        value: d.value ? `NGN ${Number(d.value).toLocaleString()}` : "—",
        unitLabel: d.unit?.label ?? "No unit",
        projectName: d.unit?.project?.name ?? "—",
        projectId: d.unit?.project?.id ?? null,
        ownerLabel: d.assignedUserId
          ? (userMap.get(d.assignedUserId)?.name ?? userMap.get(d.assignedUserId)?.email ?? "Unknown")
          : "Unassigned",
        createdAt: d.createdAt.toISOString().slice(0, 10),
      }))}
      users={userOptions}
      projectOptions={projects.map((p) => ({ id: p.id, name: p.name }))}
      campaignOptions={campaigns.map((c) => ({ id: c.id, label: `${c.name} (${c.code})` }))}
      sourceOptions={sourceOptions}
      activities={activities}
      currentUserId={session.user.id}
      whatsappMessages={whatsappMessages.map(
        (m: {
          id: string;
          direction: string;
          body: string;
          timestamp: Date;
          fromPhone: string | null;
          toPhone: string | null;
          status: string | null;
        }) => ({
          id: m.id,
          direction: m.direction,
          body: m.body,
          timestamp: m.timestamp.toISOString(),
          fromPhone: m.fromPhone,
          toPhone: m.toPhone,
          status: m.status,
        }),
      )}
    />
  );
}
