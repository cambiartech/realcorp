import { auth } from "@/auth";
import { DealStage, MembershipRole, MembershipStatus } from "@/generated/prisma";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { formatEnumLabel } from "@/lib/ui-format";
import { notFound } from "next/navigation";
import { getActivitiesForEntity } from "@/app/[tenantSlug]/activities/actions";
import { DealDetailWorkspace } from "./deal-detail-workspace";

export const dynamic = "force-dynamic";

const STAGE_ORDER: DealStage[] = [
  DealStage.NEW_LEAD,
  DealStage.CONTACTED,
  DealStage.QUALIFIED,
  DealStage.INSPECTION_BOOKED,
  DealStage.INSPECTION_COMPLETED,
  DealStage.NEGOTIATION,
  DealStage.RESERVATION_MADE,
  DealStage.CLOSED_WON,
  DealStage.CLOSED_LOST,
];

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; dealId: string }>;
}) {
  const { tenantSlug, dealId } = await params;
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
    select: { status: true, role: true },
  });
  assertTenantNavAccess(session, membership, tenant.settings, "deals");

  const canEdit =
    Boolean(session.user.isPlatformAdmin) ||
    (membership?.status === MembershipStatus.ACTIVE &&
      (membership.role === MembershipRole.ORG_ADMIN ||
        membership.role === MembershipRole.SALES_MANAGER ||
        membership.role === MembershipRole.SALES_EXECUTIVE));

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, tenantId: tenant.id },
    include: {
      lead: { select: { id: true, name: true, email: true, phone: true } },
      unit: {
        select: {
          id: true,
          label: true,
          purpose: true,
          unitType: true,
          status: true,
          project: { select: { id: true, name: true } },
        },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          amount: true,
          balanceDue: true,
          currency: true,
          dueDate: true,
          issuedAt: true,
        },
      },
    },
  });
  if (!deal) notFound();

  const [users, rawActivities] = await Promise.all([
    prisma.membership.findMany({
      where: { tenantId: tenant.id, status: MembershipStatus.ACTIVE },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    getActivitiesForEntity(tenantSlug, "DEAL", dealId),
  ]);

  const userMap = new Map(users.map((m) => [m.userId, m.user]));
  const ownerUser = deal.assignedUserId ? userMap.get(deal.assignedUserId) : null;
  const userOptions = users.map((m) => ({ id: m.user.id, label: m.user.name ?? m.user.email ?? m.user.id }));

  const stageIndex = STAGE_ORDER.indexOf(deal.stage);

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
    <DealDetailWorkspace
      tenantSlug={tenant.slug}
      canEdit={canEdit}
      deal={{
        id: deal.id,
        stage: deal.stage,
        stageLabel: formatEnumLabel(deal.stage),
        stageIndex,
        value: deal.value ? `NGN ${Number(deal.value).toLocaleString()}` : null,
        valueRaw: deal.value ? String(deal.value) : null,
        pendingFinance: deal.pendingFinance,
        financeDecision: deal.financeDecision,
        assignedUserId: deal.assignedUserId,
        ownerLabel: ownerUser?.name ?? ownerUser?.email ?? (deal.assignedUserId ? "Unknown" : "Unassigned"),
        createdAt: deal.createdAt.toISOString().slice(0, 10),
        updatedAt: deal.updatedAt.toISOString().slice(0, 10),
      }}
      lead={
        deal.lead
          ? {
              id: deal.lead.id,
              name: deal.lead.name ?? "Unnamed",
              email: deal.lead.email,
              phone: deal.lead.phone,
            }
          : null
      }
      unit={
        deal.unit
          ? {
              id: deal.unit.id,
              label: deal.unit.label,
              purpose: deal.unit.purpose,
              unitType: deal.unit.unitType,
              status: formatEnumLabel(deal.unit.status),
              projectId: deal.unit.project?.id ?? null,
              projectName: deal.unit.project?.name ?? "—",
            }
          : null
      }
      invoices={deal.invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: formatEnumLabel(inv.status),
        amount: `${inv.currency} ${Number(inv.amount).toLocaleString()}`,
        balanceDue: `${inv.currency} ${Number(inv.balanceDue).toLocaleString()}`,
        dueDate: inv.dueDate?.toISOString().slice(0, 10) ?? "—",
        issuedAt: inv.issuedAt?.toISOString().slice(0, 10) ?? "—",
      }))}
      stageOrder={STAGE_ORDER}
      activities={activities}
      users={userOptions}
      currentUserId={session.user.id}
    />
  );
}
