import { auth } from "@/auth";
import { DealStage, MembershipStatus } from "@/generated/prisma";
import { assertTenantNavAccess, MEMBERSHIP_FOR_NAV_SELECT } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { paginate, parsePage } from "@/lib/pagination";
import { notFound } from "next/navigation";
import { DealsWorkspace } from "./deals-workspace";

export const dynamic = "force-dynamic";
const DEALS_PAGE_SIZE = 50;

export default async function DealsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{
    leadId?: string;
    owner?: string;
    stage?: string;
    projectId?: string;
    view?: string;
    dealsPage?: string;
  }>;
}) {
  const { tenantSlug } = await params;
  const query = await searchParams;
  const { leadId, owner, stage, projectId, view, dealsPage } = query;
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
  assertTenantNavAccess(session, membership, tenant.settings, "deals");
  const allowed = Boolean(session.user.isPlatformAdmin) || membership?.status === MembershipStatus.ACTIVE;
  if (!allowed) notFound();

  const parsedStage = Object.values(DealStage).includes((stage || "") as DealStage)
    ? (stage as DealStage)
    : undefined;

  const dealWhere = {
    tenantId: tenant.id,
    ...(owner ? { assignedUserId: owner } : {}),
    ...(parsedStage ? { stage: parsedStage } : {}),
    ...(projectId
      ? {
          unit: {
            projectId,
          },
        }
      : {}),
  };
  const [totalDeals, leads, users, units, projects] = await Promise.all([
    prisma.deal.count({ where: dealWhere }),
    prisma.lead.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true },
      take: 300,
    }),
    prisma.membership.findMany({
      where: { tenantId: tenant.id, status: MembershipStatus.ACTIVE },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    prisma.unit.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ project: { name: "asc" } }, { label: "asc" }],
      select: { id: true, label: true, project: { select: { name: true } } },
      take: 400,
    }),
    prisma.project.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true },
      take: 400,
    }),
  ]);
  const pagination = paginate(totalDeals, parsePage(dealsPage), DEALS_PAGE_SIZE);
  const deals = await prisma.deal.findMany({
    where: dealWhere,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: pagination.skip,
    take: pagination.pageSize,
    include: {
      lead: { select: { id: true, name: true, score: true } },
      unit: {
        select: { id: true, label: true, projectId: true, project: { select: { id: true, name: true } } },
      },
    },
  });

  const userMap = new Map(users.map((u) => [u.user.id, u.user]));
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const buildDealsHref = (next: { owner?: string; stage?: string; projectId?: string }) => {
    const qp = new URLSearchParams();
    if (next.owner) qp.set("owner", next.owner);
    if (next.stage) qp.set("stage", next.stage);
    if (next.projectId) qp.set("projectId", next.projectId);
    return `/${tenant.slug}/deals${qp.toString() ? `?${qp.toString()}` : ""}`;
  };
  const activeFilterChips: Array<{ label: string; clearHref: string }> = [];
  if (owner) {
    const ownerLabel = userMap.get(owner)?.name || userMap.get(owner)?.email || owner;
    activeFilterChips.push({
      label: `Owner: ${ownerLabel}`,
      clearHref: buildDealsHref({ stage: parsedStage, projectId }),
    });
  }
  if (parsedStage) {
    activeFilterChips.push({
      label: `Stage: ${parsedStage.replaceAll("_", " ")}`,
      clearHref: buildDealsHref({ owner, projectId }),
    });
  }
  if (projectId) {
    activeFilterChips.push({
      label: `Project: ${projectMap.get(projectId) || projectId}`,
      clearHref: buildDealsHref({ owner, stage: parsedStage }),
    });
  }

  return (
    <DealsWorkspace
      tenantSlug={tenant.slug}
      tenantName={tenant.name}
      defaultLeadId={leadId}
      activeFilterChips={activeFilterChips}
      initialView={view === "list" ? "list" : "kanban"}
      pagination={pagination}
      paginationSearchParams={query}
      deals={deals.map((deal) => ({
        id: deal.id,
        leadId: deal.leadId,
        leadName: deal.lead?.name || "Direct deal",
        leadScore: deal.lead?.score ?? 0,
        unitLabel: deal.unit?.label || "No unit",
        projectName: deal.unit?.project?.name ?? "—",
        projectId: deal.unit?.project?.id ?? null,
        owner: deal.assignedUserId
          ? userMap.get(deal.assignedUserId)?.name || userMap.get(deal.assignedUserId)?.email || "Unknown"
          : "Unassigned",
        value: deal.value ? `NGN ${Number(deal.value).toLocaleString()}` : "—",
        pendingFinance: deal.pendingFinance,
        stage: deal.stage,
        createdAt: deal.createdAt.toISOString().slice(0, 10),
      }))}
      leads={leads.map((lead) => ({
        id: lead.id,
        label: lead.name || lead.email || lead.id,
      }))}
      units={units.map((unit) => ({
        id: unit.id,
        label: unit.label,
        group: unit.project.name,
      }))}
      users={users.map((u) => ({
        id: u.user.id,
        label: u.user.name || u.user.email || u.user.id,
      }))}
    />
  );
}
