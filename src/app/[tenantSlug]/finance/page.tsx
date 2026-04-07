import { auth } from "@/auth";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { formatEnumLabel } from "@/lib/ui-format";
import { notFound } from "next/navigation";
import { FinanceWorkspace } from "./finance-workspace";

export const dynamic = "force-dynamic";

function canManageFinance(
  isPlatformAdmin: boolean,
  membership: { status: MembershipStatus; role: MembershipRole } | null,
) {
  if (isPlatformAdmin) return true;
  if (!membership || membership.status !== MembershipStatus.ACTIVE) return false;
  return membership.role === MembershipRole.ORG_ADMIN || membership.role === MembershipRole.FINANCE_MANAGER;
}

export default async function FinanceQueuePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{
    activeTab?: string;
    recordsTab?: string;
    logsPage?: string;
    logsQ?: string;
    logsModule?: string;
    logsAction?: string;
    logsActor?: string;
    logsFrom?: string;
    logsTo?: string;
    logsEntityType?: string;
    logsEntityId?: string;
  }>;
}) {
  const { tenantSlug } = await params;
  const logsParams = await searchParams;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      slug: true,
      defaultCurrency: true,
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

  assertTenantNavAccess(session, membership, tenant.settings, "finance");

  const canView = Boolean(session.user.isPlatformAdmin) || membership?.status === MembershipStatus.ACTIVE;
  if (!canView) notFound();

  const canManage = canManageFinance(Boolean(session.user.isPlatformAdmin), membership);

  const logsPageSize = 50;
  const logsPage = Math.max(1, Number(logsParams.logsPage || "1") || 1);
  const logsWhere: {
    tenantId: string;
    module?: string;
    action?: string;
    actorLabel?: string;
    entityType?: string;
    entityId?: string;
    createdAt?: { gte?: Date; lte?: Date };
    OR?: Array<{ summary: { contains: string; mode: "insensitive" } } | { action: { contains: string; mode: "insensitive" } } | { actorLabel: { contains: string; mode: "insensitive" } }>;
  } = {
    tenantId: tenant.id,
  };
  if (logsParams.logsModule) logsWhere.module = logsParams.logsModule;
  if (logsParams.logsAction) logsWhere.action = logsParams.logsAction;
  if (logsParams.logsActor) logsWhere.actorLabel = logsParams.logsActor;
  if (logsParams.logsEntityType) logsWhere.entityType = logsParams.logsEntityType;
  if (logsParams.logsEntityId) logsWhere.entityId = logsParams.logsEntityId;
  if (logsParams.logsFrom || logsParams.logsTo) {
    logsWhere.createdAt = {};
    if (logsParams.logsFrom) logsWhere.createdAt.gte = new Date(`${logsParams.logsFrom}T00:00:00.000Z`);
    if (logsParams.logsTo) logsWhere.createdAt.lte = new Date(`${logsParams.logsTo}T23:59:59.999Z`);
  }
  if (logsParams.logsQ?.trim()) {
    const q = logsParams.logsQ.trim();
    logsWhere.OR = [
      { summary: { contains: q, mode: "insensitive" } },
      { action: { contains: q, mode: "insensitive" } },
      { actorLabel: { contains: q, mode: "insensitive" } },
    ];
  }

  const [deals, recentDecisions, users, dealOptions, invoices, payments, masterLogs, totalLogs, allLogValues, invoiceAuditEvents] =
    await Promise.all([
    prisma.deal.findMany({
      where: { tenantId: tenant.id, pendingFinance: true },
      orderBy: { createdAt: "asc" },
      include: {
        lead: { select: { name: true, email: true } },
      },
      take: 500,
    }),
    prisma.deal.findMany({
      where: {
        tenantId: tenant.id,
        pendingFinance: false,
        financeReviewedAt: { not: null },
      },
      orderBy: { financeReviewedAt: "desc" },
      include: {
        lead: { select: { name: true, email: true } },
      },
      take: 30,
    }),
    prisma.membership.findMany({
      where: { tenantId: tenant.id, status: MembershipStatus.ACTIVE },
      include: { user: { select: { id: true, name: true, email: true } } },
      take: 200,
    }),
    prisma.deal.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      include: { lead: { select: { name: true, email: true } } },
      take: 300,
    }),
    prisma.invoice.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      include: {
        payments: { select: { id: true, amount: true, paidAt: true }, orderBy: { paidAt: "desc" } },
        deal: { select: { id: true, lead: { select: { name: true, email: true } } } },
      },
      take: 300,
    }),
    prisma.paymentRecord.findMany({
      where: { tenantId: tenant.id },
      orderBy: { paidAt: "desc" },
      include: { invoice: { select: { invoiceNumber: true, title: true } } },
      take: 300,
    }),
    prisma.auditLog.findMany({
      where: logsWhere,
      orderBy: { createdAt: "desc" },
      skip: (logsPage - 1) * logsPageSize,
      take: logsPageSize,
    }),
    prisma.auditLog.count({ where: logsWhere }),
    prisma.auditLog.findMany({
      where: { tenantId: tenant.id },
      select: { module: true, action: true, actorLabel: true },
      take: 1500,
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: {
        tenantId: tenant.id,
        module: "FINANCE",
        entityType: "INVOICE",
        action: { in: ["SEND", "SEND_REMINDER"] },
      },
      select: {
        entityId: true,
        action: true,
        createdAt: true,
      },
      take: 3000,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const userMap = new Map(users.map((u) => [u.user.id, u.user]));
  const invoiceEventMap = new Map<string, { reminderCount: number; lastReminderAt: Date | null; lastSentAt: Date | null }>();
  for (const event of invoiceAuditEvents) {
    if (!event.entityId) continue;
    const existing = invoiceEventMap.get(event.entityId) || { reminderCount: 0, lastReminderAt: null, lastSentAt: null };
    if (event.action === "SEND_REMINDER") {
      existing.reminderCount += 1;
      if (!existing.lastReminderAt || event.createdAt > existing.lastReminderAt) existing.lastReminderAt = event.createdAt;
    }
    if (event.action === "SEND") {
      if (!existing.lastSentAt || event.createdAt > existing.lastSentAt) existing.lastSentAt = event.createdAt;
    }
    invoiceEventMap.set(event.entityId, existing);
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  const invoiceRows = invoices.map((invoice) => {
    const dueDate = invoice.dueDate;
    const isOpen = invoice.status !== "VOID" && invoice.status !== "PAID" && Number(invoice.balanceDue) > 0;
    const overdueDays =
      isOpen && dueDate && dueDate.getTime() < startOfToday.getTime()
        ? Math.floor((startOfToday.getTime() - dueDate.getTime()) / MS_PER_DAY)
        : 0;
    const eventMeta = invoiceEventMap.get(invoice.id) || { reminderCount: 0, lastReminderAt: null, lastSentAt: null };
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      title: invoice.title,
      status: formatEnumLabel(invoice.status),
      statusValue: invoice.status,
      amountLabel: `${invoice.currency} ${Number(invoice.amount).toLocaleString()}`,
      amountValue: Number(invoice.amount),
      currency: invoice.currency,
      balanceLabel: `${invoice.currency} ${Number(invoice.balanceDue).toLocaleString()}`,
      balanceValue: Number(invoice.balanceDue),
      dueDateLabel: dueDate ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(dueDate) : "No due date",
      dueDateValue: dueDate ? dueDate.toISOString().slice(0, 10) : "",
      paymentsCount: invoice.payments.length,
      lastPaymentLabel: invoice.payments[0]
        ? `${invoice.currency} ${Number(invoice.payments[0].amount).toLocaleString()} on ${new Intl.DateTimeFormat("en-NG", {
            dateStyle: "medium",
          }).format(invoice.payments[0].paidAt)}`
        : "No payments",
      canRecordPayment: Number(invoice.balanceDue) > 0 && invoice.status !== "VOID" && invoice.status !== "DRAFT",
      canSend: invoice.status === "DRAFT",
      canVoid: invoice.status !== "VOID" && Number(invoice.amount) - Number(invoice.balanceDue) <= 0,
      canSendReminder:
        invoice.status !== "DRAFT" && invoice.status !== "VOID" && invoice.status !== "PAID" && Number(invoice.balanceDue) > 0,
      isOverdue: overdueDays > 0,
      overdueDays,
      reminderCount: eventMeta.reminderCount,
      lastReminderLabel: eventMeta.lastReminderAt
        ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(eventMeta.lastReminderAt)
        : "Never",
      followUpOwner: invoice.deal?.lead?.name || invoice.deal?.lead?.email || "Unassigned contact",
    };
  });

  const openInvoices = invoiceRows.filter((x) => x.balanceValue > 0 && x.statusValue !== "VOID" && x.statusValue !== "PAID");
  const overdueInvoices = openInvoices
    .filter((x) => x.isOverdue)
    .sort((a, b) => b.overdueDays - a.overdueDays)
    .slice(0, 150);
  const agingBuckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, noDueDate: 0 };
  for (const row of openInvoices) {
    if (!row.dueDateValue) {
      agingBuckets.noDueDate += row.balanceValue;
      continue;
    }
    if (!row.isOverdue) agingBuckets.current += row.balanceValue;
    else if (row.overdueDays <= 30) agingBuckets.d1_30 += row.balanceValue;
    else if (row.overdueDays <= 60) agingBuckets.d31_60 += row.balanceValue;
    else if (row.overdueDays <= 90) agingBuckets.d61_90 += row.balanceValue;
    else agingBuckets.d90_plus += row.balanceValue;
  }

  const totalInvoiced = invoiceRows
    .filter((x) => x.statusValue !== "VOID")
    .reduce((sum, row) => sum + row.amountValue, 0);
  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const outstanding = openInvoices.reduce((sum, row) => sum + row.balanceValue, 0);
  const overdueOutstanding = overdueInvoices.reduce((sum, row) => sum + row.balanceValue, 0);
  const collectionRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currentMonthCash = payments
    .filter((p) => p.paidAt >= monthStart)
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const previousMonthCash = payments
    .filter((p) => p.paidAt >= prevMonthStart && p.paidAt < monthStart)
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <FinanceWorkspace
      tenantSlug={tenant.slug}
      canManageFinance={canManage}
      deals={deals.map((deal) => ({
        id: deal.id,
        title: deal.lead?.name || deal.lead?.email || "Untitled deal",
        owner: deal.assignedUserId
          ? userMap.get(deal.assignedUserId)?.name || userMap.get(deal.assignedUserId)?.email || "Unknown"
          : "Unassigned",
        stage: formatEnumLabel(deal.stage),
        value: deal.value ? `${tenant.defaultCurrency} ${Number(deal.value).toLocaleString()}` : "—",
        createdAtLabel: new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(deal.createdAt),
      }))}
      recentDecisions={recentDecisions.map((deal) => ({
        id: deal.id,
        title: deal.lead?.name || deal.lead?.email || "Untitled deal",
        decision: deal.financeDecision === "REJECTED" ? "Rejected" : "Approved",
        reviewedBy:
          deal.financeReviewedByLabel ||
          (deal.financeReviewedByUserId
            ? userMap.get(deal.financeReviewedByUserId)?.name ||
              userMap.get(deal.financeReviewedByUserId)?.email ||
              "Unknown"
            : "Unknown"),
        reviewedAtLabel: deal.financeReviewedAt
          ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(deal.financeReviewedAt)
          : "Unknown time",
      }))}
      dealOptions={dealOptions.map((deal) => ({
        id: deal.id,
        label: deal.lead?.name || deal.lead?.email || `Deal ${deal.id.slice(0, 8)}`,
      }))}
      invoices={invoiceRows}
      payments={payments.map((payment) => ({
        id: payment.id,
        invoiceLabel: `${payment.invoice.invoiceNumber} - ${payment.invoice.title}`,
        amountLabel: `${payment.currency} ${Number(payment.amount).toLocaleString()}`,
        method: canManage ? payment.method || "—" : "Restricted",
        reference: canManage ? payment.reference || "—" : "Restricted",
        paidAtLabel: new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(payment.paidAt),
        recordedBy: canManage ? payment.recordedByLabel || "Unknown" : "Restricted",
      }))}
      masterLogs={masterLogs.map((log) => ({
        id: log.id,
        timestamp: new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(log.createdAt),
        actor: canManage ? log.actorLabel || "System" : "Restricted",
        module: log.module,
        action: log.action,
        entityType: log.entityType,
        summary: canManage ? log.summary || "No summary" : `${log.module} ${log.action}`,
      }))}
      logFilters={{
        activeTab: logsParams.activeTab || "",
        recordsTab: logsParams.recordsTab || "",
        logsPage,
        logsQ: logsParams.logsQ || "",
        logsModule: logsParams.logsModule || "",
        logsAction: logsParams.logsAction || "",
        logsActor: logsParams.logsActor || "",
        logsFrom: logsParams.logsFrom || "",
        logsTo: logsParams.logsTo || "",
        logsEntityType: logsParams.logsEntityType || "",
        logsEntityId: logsParams.logsEntityId || "",
      }}
      logPagination={{
        total: totalLogs,
        totalPages: Math.max(1, Math.ceil(totalLogs / logsPageSize)),
        pageSize: logsPageSize,
      }}
      logFilterOptions={{
        modules: Array.from(new Set(allLogValues.map((x) => x.module))).sort((a, b) => a.localeCompare(b)),
        actions: Array.from(new Set(allLogValues.map((x) => x.action))).sort((a, b) => a.localeCompare(b)),
        actors: canManage
          ? Array.from(new Set(allLogValues.map((x) => x.actorLabel).filter(Boolean) as string[])).sort((a, b) =>
              a.localeCompare(b),
            )
          : [],
      }}
      arView={{
        totalOpenInvoices: openInvoices.length,
        overdueInvoices: overdueInvoices.length,
        followUpsNeeded: overdueInvoices.filter((x) => x.reminderCount === 0 || x.overdueDays >= 14).length,
        agingBuckets: {
          current: `${tenant.defaultCurrency} ${agingBuckets.current.toLocaleString()}`,
          d1_30: `${tenant.defaultCurrency} ${agingBuckets.d1_30.toLocaleString()}`,
          d31_60: `${tenant.defaultCurrency} ${agingBuckets.d31_60.toLocaleString()}`,
          d61_90: `${tenant.defaultCurrency} ${agingBuckets.d61_90.toLocaleString()}`,
          d90_plus: `${tenant.defaultCurrency} ${agingBuckets.d90_plus.toLocaleString()}`,
          noDueDate: `${tenant.defaultCurrency} ${agingBuckets.noDueDate.toLocaleString()}`,
        },
        followUps: overdueInvoices.map((row) => ({
          id: row.id,
          invoiceNumber: row.invoiceNumber,
          title: row.title,
          owner: row.followUpOwner,
          overdueDays: row.overdueDays,
          balanceLabel: row.balanceLabel,
          reminderCount: row.reminderCount,
          lastReminderLabel: row.lastReminderLabel,
        })),
      }}
      reportView={{
        pnlLite: {
          invoicedLabel: `${tenant.defaultCurrency} ${totalInvoiced.toLocaleString()}`,
          collectedLabel: `${tenant.defaultCurrency} ${totalCollected.toLocaleString()}`,
          outstandingLabel: `${tenant.defaultCurrency} ${outstanding.toLocaleString()}`,
        },
        cashflowLite: {
          currentMonthLabel: `${tenant.defaultCurrency} ${currentMonthCash.toLocaleString()}`,
          previousMonthLabel: `${tenant.defaultCurrency} ${previousMonthCash.toLocaleString()}`,
          deltaLabel: `${tenant.defaultCurrency} ${(currentMonthCash - previousMonthCash).toLocaleString()}`,
        },
        collections: {
          collectionRateLabel: `${collectionRate.toFixed(1)}%`,
          overdueOutstandingLabel: `${tenant.defaultCurrency} ${overdueOutstanding.toLocaleString()}`,
          overdueCount: overdueInvoices.length,
          remindersSent: invoiceRows.reduce((sum, row) => sum + row.reminderCount, 0),
        },
      }}
    />
  );
}
