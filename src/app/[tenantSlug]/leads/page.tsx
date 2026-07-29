import { auth } from "@/auth";
import { CampaignStatus, MembershipStatus } from "@/generated/prisma";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { buildLeadSourceOptions } from "@/lib/lead-source-options";
import { formatEnumLabel } from "@/lib/ui-format";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LeadsWorkspace } from "./leads-workspace";

export const dynamic = "force-dynamic";

export default async function TenantLeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ owner?: string; source?: string; project?: string; campaign?: string }>;
}) {
  const { tenantSlug } = await params;
  const { owner, source, project, campaign } = await searchParams;
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
  assertTenantNavAccess(session, membership, tenant.settings, "leads");
  const canCreate = Boolean(session.user.isPlatformAdmin) || membership?.status === MembershipStatus.ACTIVE;

  const [leads, users, projects, campaigns] = await Promise.all([
    prisma.lead.findMany({
      where: {
        tenantId: tenant.id,
        ...(owner ? { assignedUserId: owner } : {}),
        ...(source ? { source } : {}),
        ...(project ? { projectInterest: project } : {}),
        ...(campaign ? { campaignId: campaign } : {}),
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        campaign: { select: { name: true, code: true } },
        realtorPartner: { select: { displayName: true } },
      },
    }),
    prisma.membership.findMany({
      where: { tenantId: tenant.id, status: MembershipStatus.ACTIVE },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
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
  ]);

  const userMap = new Map(users.map((m) => [m.userId, m.user]));
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const sourceOptions = buildLeadSourceOptions(leads.map((lead) => lead.source));
  const campaignMap = new Map(campaigns.map((c) => [c.id, `${c.name} (${c.code})`]));
  const buildLeadsHref = (next: { owner?: string; source?: string; project?: string; campaign?: string }) => {
    const qp = new URLSearchParams();
    if (next.owner) qp.set("owner", next.owner);
    if (next.source) qp.set("source", next.source);
    if (next.project) qp.set("project", next.project);
    if (next.campaign) qp.set("campaign", next.campaign);
    return `/${tenant.slug}/leads${qp.toString() ? `?${qp.toString()}` : ""}`;
  };
  const activeFilterChips: Array<{ label: string; clearHref: string }> = [];
  if (owner) {
    const ownerLabel = userMap.get(owner)?.name || userMap.get(owner)?.email || owner;
    activeFilterChips.push({
      label: `Owner: ${ownerLabel}`,
      clearHref: buildLeadsHref({ source, project, campaign }),
    });
  }
  if (source) {
    activeFilterChips.push({
      label: `Source: ${source}`,
      clearHref: buildLeadsHref({ owner, project, campaign }),
    });
  }
  if (project) {
    activeFilterChips.push({
      label: `Project: ${projectMap.get(project) || project}`,
      clearHref: buildLeadsHref({ owner, source, campaign }),
    });
  }
  if (campaign) {
    activeFilterChips.push({
      label: `Campaign: ${campaignMap.get(campaign) || campaign}`,
      clearHref: buildLeadsHref({ owner, source, project }),
    });
  }

  return (
    <Suspense
      fallback={<div className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted">Loading leads…</div>}
    >
      <LeadsWorkspace
        tenantSlug={tenant.slug}
        tenantName={tenant.name}
        canCreate={canCreate}
        activeFilterChips={activeFilterChips}
        projectOptions={projects.map((project) => ({ id: project.id, name: project.name }))}
        campaignOptions={campaigns.map((c) => ({ id: c.id, label: `${c.name} (${c.code})` }))}
        sourceOptions={sourceOptions}
        leads={leads.map((lead) => ({
          id: lead.id,
          name: lead.name ?? "Unnamed lead",
          email: lead.email ?? "—",
          phone: lead.phone ?? "—",
          source: lead.source ?? "—",
          attribution:
            [lead.campaign?.name, lead.realtorPartner ? `Partner: ${lead.realtorPartner.displayName}` : null]
              .filter(Boolean)
              .join(" · ") || "—",
          quality: formatEnumLabel(lead.quality),
          score: lead.score,
          lastActivityAt: lead.lastActivityAt ? lead.lastActivityAt.toISOString().slice(0, 10) : null,
          owner: lead.assignedUserId
            ? userMap.get(lead.assignedUserId)?.name || userMap.get(lead.assignedUserId)?.email || "Unknown"
            : "Unassigned",
          createdAt: lead.createdAt.toISOString().slice(0, 10),
        }))}
        users={users.map((membershipItem) => ({
          id: membershipItem.user.id,
          label: membershipItem.user.name || membershipItem.user.email || membershipItem.user.id,
        }))}
      />
    </Suspense>
  );
}
