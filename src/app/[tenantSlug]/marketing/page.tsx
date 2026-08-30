import { auth } from "@/auth";
import {
  CampaignStatus,
  LeadCaptureSessionStatus,
  MembershipRole,
  MembershipStatus,
} from "@/generated/prisma";
import { parseCaptureFormFields } from "@/lib/capture-form-types";
import { assertTenantNavAccess, MEMBERSHIP_FOR_NAV_SELECT } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { headers } from "next/headers";
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
    select: MEMBERSHIP_FOR_NAV_SELECT,
  });
  assertTenantNavAccess(session, membership, tenant.settings, "marketing");
  const canEdit =
    membership?.status === MembershipStatus.ACTIVE &&
    canManageMarketing(membership.role, Boolean(session.user.isPlatformAdmin));

  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") || "http";
  const siteOrigin = `${proto}://${host}`;

  const [campaigns, totalLeads, attributedLeads, realtorLeads, captureForms, partners, sessions, projects] =
    await Promise.all([
      prisma.campaign.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { leads: true } } },
        take: 200,
      }),
      prisma.lead.count({ where: { tenantId: tenant.id } }),
      prisma.lead.count({ where: { tenantId: tenant.id, campaignId: { not: null } } }),
      prisma.lead.count({ where: { tenantId: tenant.id, realtorPartnerId: { not: null } } }),
      prisma.leadCaptureForm.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: "desc" },
        include: {
          campaign: { select: { name: true } },
          realtorPartner: { select: { displayName: true } },
        },
        take: 100,
      }),
      prisma.realtorPartner.findMany({
        where: { tenantId: tenant.id, isActive: true },
        select: { id: true, displayName: true },
        orderBy: { displayName: "asc" },
        take: 200,
      }),
      prisma.leadCaptureFormSession.findMany({
        where: { tenantId: tenant.id },
        select: {
          formId: true,
          status: true,
          utmSource: true,
          localHour: true,
        },
      }),
      prisma.project.findMany({
        where: { tenantId: tenant.id },
        select: { name: true },
        orderBy: { name: "asc" },
        take: 100,
      }),
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

  const captureFormAnalytics = captureForms.map((form) => {
    const formSessions = sessions.filter((s) => s.formId === form.id);
    const partials = formSessions.filter(
      (s) =>
        s.status === LeadCaptureSessionStatus.PARTIAL ||
        s.status === LeadCaptureSessionStatus.ABANDONED ||
        s.status === LeadCaptureSessionStatus.STARTED,
    ).length;
    const sourceCounts = new Map<string, number>();
    for (const s of formSessions) {
      if (!s.utmSource) continue;
      sourceCounts.set(s.utmSource, (sourceCounts.get(s.utmSource) ?? 0) + 1);
    }
    const topSource = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const hourCounts = new Map<number, number>();
    for (const s of formSessions) {
      if (s.localHour == null) continue;
      hourCounts.set(s.localHour, (hourCounts.get(s.localHour) ?? 0) + 1);
    }
    const peakHour = [...hourCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
      formId: form.id,
      formName: form.name,
      views: form.viewCount,
      starts: form.startCount,
      partials,
      submits: form.submitCount,
      conversionPct: form.viewCount > 0 ? Math.round((form.submitCount / form.viewCount) * 100) : 0,
      topSource,
      peakHour,
    };
  });

  return (
    <MarketingWorkspace
      tenantSlug={tenant.slug}
      tenantName={tenant.name}
      canEdit={canEdit}
      currentUserId={session.user.id}
      siteOrigin={siteOrigin}
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
      captureForms={captureForms.map((f) => ({
        id: f.id,
        name: f.name,
        slug: f.slug,
        title: f.title,
        status: f.status,
        viewCount: f.viewCount,
        startCount: f.startCount,
        submitCount: f.submitCount,
        campaignName: f.campaign?.name ?? null,
        partnerName: f.realtorPartner?.displayName ?? null,
        createdAt: f.createdAt.toISOString().slice(0, 10),
        fields: parseCaptureFormFields(f.fields),
      }))}
      captureFormAnalytics={captureFormAnalytics}
      partners={partners}
      projectOptions={projects.map((p) => p.name)}
    />
  );
}
