import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import {
  mergeCurrencyOptions,
  normalizeFinanceOptionList,
} from "@/lib/finance-catalog";
import { parseFinanceControls } from "@/lib/finance-controls";
import { loadClientDepositRows } from "@/lib/client-deposits";
import { expensePnlAmount } from "@/lib/finance-vat";
import { operatingNet } from "@/lib/finance-income";
import { formatEnumLabel } from "@/lib/ui-format";
import { loadTenantRequest } from "@/lib/tenant-request";
import { notFound } from "next/navigation";
import { FinanceWorkspace } from "./finance-workspace";

export const dynamic = "force-dynamic";
const DEFAULT_PAYMENT_MODES = ["Bank Transfer", "Cash", "Cheque", "POS"];
import { mergeOrgDepartments } from "@/lib/org-departments";

function canManageFinance(
  isPlatformAdmin: boolean,
  membership: { status: MembershipStatus; role: MembershipRole } | null,
) {
  if (isPlatformAdmin) return true;
  if (!membership || membership.status !== MembershipStatus.ACTIVE)
    return false;
  return (
    membership.role === MembershipRole.ORG_ADMIN ||
    membership.role === MembershipRole.FINANCE_MANAGER
  );
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
  const { session, tenant, membership } = await loadTenantRequest(tenantSlug);
  if (!session?.user?.id) notFound();
  if (!tenant) notFound();
  const financeControls = parseFinanceControls(tenant.settings?.financeControls);

  assertTenantNavAccess(session, membership, tenant.settings, "finance");

  const canView =
    Boolean(session.user.isPlatformAdmin) ||
    membership?.status === MembershipStatus.ACTIVE;
  if (!canView) notFound();

  const canManage = canManageFinance(
    Boolean(session.user.isPlatformAdmin),
    membership,
  );
  const financeSurface = logsParams.recordsTab || "overview";
  const isOverview = financeSurface === "overview";
  const needsDeals = isOverview;
  const needsDealOptions =
    financeSurface === "invoices" || financeSurface === "receipts";
  const needsDimensions =
    isOverview ||
    ["reports", "expenses", "invoices", "payments", "receipts", "remittances"].includes(
      financeSurface,
    );
  const needsReceipts =
    isOverview || ["reports", "receipts"].includes(financeSurface);
  const needsInvoices =
    isOverview ||
    ["reports", "invoices", "ar", "payments"].includes(financeSurface);
  const needsPayments =
    isOverview || ["reports", "payments", "banking"].includes(financeSurface);
  const needsExpenses =
    isOverview || ["reports", "expenses", "banking"].includes(financeSurface);
  const needsRemittances =
    isOverview || ["reports", "remittances", "banking"].includes(financeSurface);
  const needsRemittanceClients = financeSurface === "remittances";
  const needsBills =
    isOverview || financeSurface === "reports" || financeSurface === "payables";
  const needsInvoiceEvents =
    isOverview || ["reports", "invoices", "ar"].includes(financeSurface);
  const needsBanking = isOverview || financeSurface === "banking";
  const needsLogs = financeSurface === "logs";

  const [activeFiscalGoal, financeVendors, financeExpenseCategories] =
    await Promise.all([
      financeSurface === "payables"
        ? prisma.tenantGoal.findFirst({
            where: { tenantId: tenant.id, isActive: true },
            orderBy: { updatedAt: "desc" },
            select: { label: true, fiscalYearStart: true, fiscalYearEnd: true },
          })
        : Promise.resolve(null),
      ["expenses", "payables"].includes(financeSurface)
        ? prisma.financeVendor.findMany({
            where: { tenantId: tenant.id },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      financeSurface === "expenses"
        ? prisma.financeExpenseCategory.findMany({
            where: { tenantId: tenant.id },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);

  const savedBanks = normalizeFinanceOptionList(
    tenant.settings?.financeBankAccounts,
  );
  const savedModes = normalizeFinanceOptionList(
    tenant.settings?.financePaymentModes,
  );
  const mergedModes =
    savedModes.length > 0
      ? Array.from(new Set([...DEFAULT_PAYMENT_MODES, ...savedModes]))
      : DEFAULT_PAYMENT_MODES;
  const currenciesMerged = mergeCurrencyOptions(
    tenant.settings?.financeCurrencies,
    tenant.defaultCurrency || "NGN",
  );

  const financeOptions = {
    bankAccounts: savedBanks,
    paymentModes: mergedModes,
    currencies: currenciesMerged,
    departments: mergeOrgDepartments(
      tenant.settings?.orgDepartments as string[] | null | undefined,
    ),
  };

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
    OR?: Array<
      | { summary: { contains: string; mode: "insensitive" } }
      | { action: { contains: string; mode: "insensitive" } }
      | { actorLabel: { contains: string; mode: "insensitive" } }
    >;
  } = {
    tenantId: tenant.id,
  };
  if (logsParams.logsModule) logsWhere.module = logsParams.logsModule;
  if (logsParams.logsAction) logsWhere.action = logsParams.logsAction;
  if (logsParams.logsActor) logsWhere.actorLabel = logsParams.logsActor;
  if (logsParams.logsEntityType)
    logsWhere.entityType = logsParams.logsEntityType;
  if (logsParams.logsEntityId) logsWhere.entityId = logsParams.logsEntityId;
  if (logsParams.logsFrom || logsParams.logsTo) {
    logsWhere.createdAt = {};
    if (logsParams.logsFrom)
      logsWhere.createdAt.gte = new Date(
        `${logsParams.logsFrom}T00:00:00.000Z`,
      );
    if (logsParams.logsTo)
      logsWhere.createdAt.lte = new Date(`${logsParams.logsTo}T23:59:59.999Z`);
  }
  if (logsParams.logsQ?.trim()) {
    const q = logsParams.logsQ.trim();
    logsWhere.OR = [
      { summary: { contains: q, mode: "insensitive" } },
      { action: { contains: q, mode: "insensitive" } },
      { actorLabel: { contains: q, mode: "insensitive" } },
    ];
  }

  const [
    deals,
    recentDecisions,
    users,
    dealOptions,
    projects,
    units,
    invoices,
    payments,
    expenses,
    vendorBills,
    salesReceipts,
    masterLogs,
    totalLogs,
    allLogValues,
    invoiceAuditEvents,
    bankRows,
    bankImports,
    bankRowStats,
    remittances,
    remittanceClients,
  ] = await Promise.all([
    needsDeals
      ? prisma.deal.findMany({
          where: { tenantId: tenant.id, pendingFinance: true },
          orderBy: { createdAt: "asc" },
          include: {
            lead: { select: { name: true, email: true } },
          },
          take: 500,
        })
      : Promise.resolve([]),
    needsDeals
      ? prisma.deal.findMany({
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
        })
      : Promise.resolve([]),
    needsDeals
      ? prisma.membership.findMany({
          where: { tenantId: tenant.id, status: MembershipStatus.ACTIVE },
          include: { user: { select: { id: true, name: true, email: true } } },
          take: 200,
        })
      : Promise.resolve([]),
    needsDealOptions
      ? prisma.deal.findMany({
          where: { tenantId: tenant.id },
          orderBy: { createdAt: "desc" },
          include: { lead: { select: { name: true, email: true } } },
          take: 300,
        })
      : Promise.resolve([]),
    needsDimensions
      ? prisma.project.findMany({
          where: { tenantId: tenant.id },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take: 400,
        })
      : Promise.resolve([]),
    needsDimensions
      ? prisma.unit.findMany({
          where: { tenantId: tenant.id },
          select: { id: true, label: true, projectId: true },
          orderBy: [{ createdAt: "desc" }],
          take: 1200,
        })
      : Promise.resolve([]),
    needsInvoices
      ? prisma.invoice.findMany({
          where: { tenantId: tenant.id },
          orderBy: { createdAt: "desc" },
          include: {
            payments: {
              where: { voidedAt: null },
              select: { id: true, amount: true, paidAt: true },
              orderBy: { paidAt: "desc" },
            },
            deal: {
              select: {
                id: true,
                unitId: true,
                unit: {
                  select: {
                    id: true,
                    label: true,
                    project: { select: { id: true, name: true } },
                  },
                },
                lead: { select: { name: true, email: true } },
                propertyClient: { select: { fullName: true, email: true } },
              },
            },
          },
          take: 300,
        })
      : Promise.resolve([]),
    needsPayments
      ? prisma.paymentRecord.findMany({
          where: { tenantId: tenant.id, voidedAt: null },
          orderBy: { paidAt: "desc" },
          include: {
            invoice: {
              select: {
                invoiceNumber: true,
                title: true,
                department: true,
                deal: {
                  select: {
                    unitId: true,
                    unit: {
                      select: {
                        id: true,
                        label: true,
                        project: { select: { id: true, name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
          take: 300,
        })
      : Promise.resolve([]),
    needsExpenses
      ? prisma.expense.findMany({
          where: { tenantId: tenant.id, voidedAt: null },
          orderBy: { expenseDate: "desc" },
          take: 300,
        })
      : Promise.resolve([]),
    needsBills
      ? prisma.vendorBill.findMany({
          where: { tenantId: tenant.id },
          orderBy: { issuedAt: "desc" },
          take: 300,
        })
      : Promise.resolve([]),
    needsReceipts
      ? prisma.salesReceipt.findMany({
          where: { tenantId: tenant.id, voidedAt: null, status: { not: "VOID" } },
          orderBy: { issuedAt: "desc" },
          include: {
            deal: {
              select: {
                unitId: true,
                unit: {
                  select: {
                    id: true,
                    label: true,
                    project: { select: { id: true, name: true } },
                  },
                },
                lead: { select: { name: true, email: true } },
                propertyClient: { select: { email: true, fullName: true } },
              },
            },
          },
          take: 300,
        })
      : Promise.resolve([]),
    needsLogs
      ? prisma.auditLog.findMany({
          where: logsWhere,
          orderBy: { createdAt: "desc" },
          skip: (logsPage - 1) * logsPageSize,
          take: logsPageSize,
        })
      : Promise.resolve([]),
    needsLogs
      ? prisma.auditLog.count({ where: logsWhere })
      : Promise.resolve(0),
    needsLogs
      ? prisma.auditLog.findMany({
          where: { tenantId: tenant.id },
          select: { module: true, action: true, actorLabel: true },
          take: 1500,
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    needsInvoiceEvents
      ? prisma.auditLog.findMany({
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
        })
      : Promise.resolve([]),
    financeSurface === "banking"
      ? prisma.bankStatementRow.findMany({
          where: { tenantId: tenant.id },
          include: {
            import: {
              select: {
                id: true,
                sourceName: true,
                importedAt: true,
                finalizedAt: true,
              },
            },
          },
          orderBy: [{ createdAt: "desc" }],
          take: 300,
        })
      : Promise.resolve([]),
    needsBanking
      ? prisma.bankStatementImport.findMany({
          where: { tenantId: tenant.id },
          orderBy: { importedAt: "desc" },
          take: 50,
          select: {
            id: true,
            sourceName: true,
            importedAt: true,
            finalizedAt: true,
          },
        })
      : Promise.resolve([]),
    needsBanking
      ? prisma.bankStatementRow.groupBy({
          by: ["importId", "matchStatus"],
          where: { tenantId: tenant.id },
          _count: { _all: true },
        })
      : Promise.resolve([]),
    needsRemittances
      ? prisma.clientRemittance.findMany({
          where: { tenantId: tenant.id, voidedAt: null },
          orderBy: { remittedAt: "desc" },
          include: {
            propertyClient: { select: { id: true, fullName: true, email: true } },
          },
          take: 500,
        })
      : Promise.resolve([]),
    needsRemittanceClients
      ? prisma.propertyClient.findMany({
          where: { tenantId: tenant.id },
          orderBy: { fullName: "asc" },
          select: { id: true, fullName: true, email: true },
          take: 800,
        })
      : Promise.resolve([]),
  ]);

  const bankStatsMap = new Map<
    string,
    { total: number; matched: number; unmatched: number }
  >();
  for (const stat of bankRowStats) {
    const current = bankStatsMap.get(stat.importId) || {
      total: 0,
      matched: 0,
      unmatched: 0,
    };
    current.total += stat._count._all;
    if (stat.matchStatus === "MATCHED") current.matched += stat._count._all;
    else current.unmatched += stat._count._all;
    bankStatsMap.set(stat.importId, current);
  }

  const projectMap = new Map(projects.map((p) => [p.id, p.name]));
  const unitMap = new Map(
    units.map((u) => [
      u.id,
      {
        label: u.label,
        projectId: u.projectId,
        projectName: projectMap.get(u.projectId) || "Unknown project",
      },
    ]),
  );

  const resolveAllocation = (row: {
    projectId?: string | null;
    unitId?: string | null;
    deal?: {
      unit?: {
        id: string;
        label: string;
        project?: { id: string; name: string } | null;
      } | null;
    } | null;
  }) => {
    const projectId = row.projectId || row.deal?.unit?.project?.id || "";
    const unitId = row.unitId || row.deal?.unit?.id || "";
    return {
      projectId,
      projectLabel: projectId
        ? projectMap.get(projectId) ||
          row.deal?.unit?.project?.name ||
          "Unknown project"
        : "Unassigned project",
      unitId,
      unitLabel: unitId
        ? unitMap.get(unitId)?.label ||
          row.deal?.unit?.label ||
          "Unknown unit"
        : "Unassigned unit",
    };
  };

  const livePayments = payments.filter((payment) => !payment.voidedAt);
  const liveExpenses = expenses.filter((expense) => !expense.voidedAt);
  const liveRemittances = remittances.filter((row) => !row.voidedAt);
  const liveReceipts = salesReceipts.filter(
    (receipt) => !receipt.voidedAt && receipt.status !== "VOID",
  );

  const clientDepositRows =
    financeSurface === "reports" ? await loadClientDepositRows(tenant.id) : [];

  const userMap = new Map(users.map((u) => [u.user.id, u.user]));
  const invoiceEventMap = new Map<
    string,
    {
      reminderCount: number;
      lastReminderAt: Date | null;
      lastSentAt: Date | null;
    }
  >();
  for (const event of invoiceAuditEvents) {
    if (!event.entityId) continue;
    const existing = invoiceEventMap.get(event.entityId) || {
      reminderCount: 0,
      lastReminderAt: null,
      lastSentAt: null,
    };
    if (event.action === "SEND_REMINDER") {
      existing.reminderCount += 1;
      if (!existing.lastReminderAt || event.createdAt > existing.lastReminderAt)
        existing.lastReminderAt = event.createdAt;
    }
    if (event.action === "SEND") {
      if (!existing.lastSentAt || event.createdAt > existing.lastSentAt)
        existing.lastSentAt = event.createdAt;
    }
    invoiceEventMap.set(event.entityId, existing);
  }

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  const invoiceRows = invoices.map((invoice) => {
    const dueDate = invoice.dueDate;
    const isOpen =
      invoice.status !== "VOID" &&
      invoice.status !== "PAID" &&
      Number(invoice.balanceDue) > 0;
    const overdueDays =
      isOpen && dueDate && dueDate.getTime() < startOfToday.getTime()
        ? Math.floor((startOfToday.getTime() - dueDate.getTime()) / MS_PER_DAY)
        : 0;
    const eventMeta = invoiceEventMap.get(invoice.id) || {
      reminderCount: 0,
      lastReminderAt: null,
      lastSentAt: null,
    };
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
      dueDateLabel: dueDate
        ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(
            dueDate,
          )
        : "No due date",
      dueDateValue: dueDate ? dueDate.toISOString().slice(0, 10) : "",
      issuedAtValue: invoice.createdAt.toISOString().slice(0, 10),
      paymentsCount: invoice.payments.length,
      lastPaymentLabel: invoice.payments[0]
        ? `${invoice.currency} ${Number(invoice.payments[0].amount).toLocaleString()} on ${new Intl.DateTimeFormat(
            "en-NG",
            {
              dateStyle: "medium",
            },
          ).format(invoice.payments[0].paidAt)}`
        : "No payments",
      canRecordPayment:
        Number(invoice.balanceDue) > 0 &&
        invoice.status !== "VOID" &&
        invoice.status !== "DRAFT",
      canSend: invoice.status === "DRAFT",
      canResend:
        invoice.status !== "DRAFT" &&
        invoice.status !== "VOID" &&
        invoice.status !== "PAID" &&
        Number(invoice.balanceDue) > 0,
      defaultEmail:
        invoice.deal?.propertyClient?.email || invoice.deal?.lead?.email || "",
      customerName:
        invoice.deal?.propertyClient?.fullName ||
        invoice.deal?.lead?.name ||
        "",
      pdfUrl: invoice.pdfUrl,
      sentToEmail: invoice.sentToEmail,
      canVoid:
        invoice.status !== "VOID" &&
        Number(invoice.amount) - Number(invoice.balanceDue) <= 0,
      canSendReminder:
        invoice.status !== "DRAFT" &&
        invoice.status !== "VOID" &&
        invoice.status !== "PAID" &&
        Number(invoice.balanceDue) > 0,
      isOverdue: overdueDays > 0,
      overdueDays,
      reminderCount: eventMeta.reminderCount,
      lastReminderLabel: eventMeta.lastReminderAt
        ? new Intl.DateTimeFormat("en-NG", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(eventMeta.lastReminderAt)
        : "Never",
      followUpOwner:
        invoice.deal?.lead?.name ||
        invoice.deal?.lead?.email ||
        "Unassigned contact",
      ...resolveAllocation(invoice),
      incomeType: invoice.incomeType,
      department: invoice.department || "",
    };
  });

  const openInvoices = invoiceRows.filter(
    (x) =>
      x.balanceValue > 0 &&
      x.statusValue !== "VOID" &&
      x.statusValue !== "PAID",
  );
  const overdueInvoices = openInvoices
    .filter((x) => x.isOverdue)
    .sort((a, b) => b.overdueDays - a.overdueDays)
    .slice(0, 150);
  const agingBuckets = {
    current: 0,
    d1_30: 0,
    d31_60: 0,
    d61_90: 0,
    d90_plus: 0,
    noDueDate: 0,
  };
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
  const totalCollected =
    livePayments.reduce((sum, p) => sum + Number(p.amount), 0) +
    liveReceipts.reduce((sum, r) => sum + Number(r.amount), 0);
  const outstanding = openInvoices.reduce(
    (sum, row) => sum + row.balanceValue,
    0,
  );
  const overdueOutstanding = overdueInvoices.reduce(
    (sum, row) => sum + row.balanceValue,
    0,
  );
  const collectionRate =
    totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currentMonthCash =
    livePayments
      .filter((p) => p.paidAt >= monthStart)
      .reduce((sum, p) => sum + Number(p.amount), 0) +
    liveReceipts
      .filter((r) => r.issuedAt >= monthStart)
      .reduce((sum, r) => sum + Number(r.amount), 0);
  const previousMonthCash =
    livePayments
      .filter((p) => p.paidAt >= prevMonthStart && p.paidAt < monthStart)
      .reduce((sum, p) => sum + Number(p.amount), 0) +
    liveReceipts
      .filter((r) => r.issuedAt >= prevMonthStart && r.issuedAt < monthStart)
      .reduce((sum, r) => sum + Number(r.amount), 0);

  const monthKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map((x) => Number(x));
    return new Intl.DateTimeFormat("en-NG", {
      month: "short",
      year: "numeric",
    }).format(new Date(y, (m || 1) - 1, 1));
  };
  const recentMonthKeys: string[] = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    recentMonthKeys.push(monthKey(d));
  }

  const invoicedByMonth = new Map<string, number>();
  for (const invoice of invoices) {
    if (invoice.status === "VOID") continue;
    const key = monthKey(invoice.createdAt);
    invoicedByMonth.set(
      key,
      (invoicedByMonth.get(key) || 0) + Number(invoice.amount),
    );
  }
  const collectedByMonth = new Map<string, number>();
  for (const payment of livePayments) {
    const key = monthKey(payment.paidAt);
    collectedByMonth.set(
      key,
      (collectedByMonth.get(key) || 0) + Number(payment.amount),
    );
  }
  for (const receipt of liveReceipts) {
    const key = monthKey(receipt.issuedAt);
    collectedByMonth.set(
      key,
      (collectedByMonth.get(key) || 0) + Number(receipt.amount),
    );
  }
  const expenseByMonth = new Map<string, number>();
  const expenseCashByMonth = new Map<string, number>();
  for (const expense of liveExpenses) {
    const key = monthKey(expense.expenseDate);
    const pnlAmount = expensePnlAmount({
      grossAmount: Number(expense.amount),
      subtotal: Number(expense.subtotal),
      vatRecoverable: expense.vatRecoverable,
    });
    expenseByMonth.set(key, (expenseByMonth.get(key) || 0) + pnlAmount);
    expenseCashByMonth.set(
      key,
      (expenseCashByMonth.get(key) || 0) + Number(expense.amount),
    );
  }
  const remittedByMonth = new Map<string, number>();
  for (const remittance of liveRemittances) {
    const key = monthKey(remittance.remittedAt);
    remittedByMonth.set(
      key,
      (remittedByMonth.get(key) || 0) + Number(remittance.amount),
    );
  }
  const pnlBreakdown = recentMonthKeys.map((key) => {
    const invoiced = invoicedByMonth.get(key) || 0;
    const collected = collectedByMonth.get(key) || 0;
    const expenseTotal = expenseByMonth.get(key) || 0;
    const remitted = remittedByMonth.get(key) || 0;
    return {
      month: monthLabel(key),
      invoiced,
      collected,
      expenses: expenseTotal,
      remitted,
      net: operatingNet({ collected, expenses: expenseTotal, remitted }),
    };
  });
  const cashflowBreakdown = recentMonthKeys.map((key) => {
    const inflow = collectedByMonth.get(key) || 0;
    const remitted = remittedByMonth.get(key) || 0;
    const outflow = (expenseCashByMonth.get(key) || 0) + remitted;
    return {
      month: monthLabel(key),
      inflow,
      outflow,
      net: inflow - outflow,
    };
  });
  const expenseCategoryMap = new Map<
    string,
    { total: number; count: number }
  >();
  for (const expense of liveExpenses) {
    const category = expense.category || "Uncategorized";
    const current = expenseCategoryMap.get(category) || { total: 0, count: 0 };
    current.total += expensePnlAmount({
      grossAmount: Number(expense.amount),
      subtotal: Number(expense.subtotal),
      vatRecoverable: expense.vatRecoverable,
    });
    current.count += 1;
    expenseCategoryMap.set(category, current);
  }
  const expenseBreakdown = Array.from(expenseCategoryMap.entries())
    .map(([category, v]) => ({ category, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);

  const openVendorBills = vendorBills.filter(
    (b) =>
      b.status !== "VOID" && b.status !== "PAID" && Number(b.balanceDue) > 0,
  );
  const payablesOutstanding = openVendorBills.reduce(
    (sum, b) => sum + Number(b.balanceDue),
    0,
  );
  const payablesOverdueCount = openVendorBills.filter(
    (b) => b.dueDate && b.dueDate.getTime() < startOfToday.getTime(),
  ).length;
  const currentMonthExpenses = expenses
    .filter((e) => e.expenseDate >= monthStart)
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const bankingUnmatched = Array.from(bankStatsMap.values()).reduce(
    (sum, s) => sum + s.unmatched,
    0,
  );
  const currency = tenant.defaultCurrency || "NGN";
  const money = (n: number) => `${currency} ${n.toLocaleString()}`;

  return (
    <FinanceWorkspace
      tenantSlug={tenant.slug}
      canManageFinance={canManage}
      overviewStats={{
        outstandingReceivables: money(outstanding),
        overdueReceivables: money(overdueOutstanding),
        overdueInvoiceCount: overdueInvoices.length,
        openPayables: money(payablesOutstanding),
        payablesOverdueCount,
        collectedThisMonth: money(currentMonthCash),
        expensesThisMonth: money(currentMonthExpenses),
        pendingFinanceChecks: deals.length,
        openInvoiceCount: openInvoices.length,
        openPayableCount: openVendorBills.length,
        bankingUnmatched,
      }}
      deals={deals.map((deal) => ({
        id: deal.id,
        title: deal.lead?.name || deal.lead?.email || "Untitled deal",
        owner: deal.assignedUserId
          ? userMap.get(deal.assignedUserId)?.name ||
            userMap.get(deal.assignedUserId)?.email ||
            "Unknown"
          : "Unassigned",
        stage: formatEnumLabel(deal.stage),
        value: deal.value
          ? `${tenant.defaultCurrency} ${Number(deal.value).toLocaleString()}`
          : "—",
        createdAtLabel: new Intl.DateTimeFormat("en-NG", {
          dateStyle: "medium",
        }).format(deal.createdAt),
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
          ? new Intl.DateTimeFormat("en-NG", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(deal.financeReviewedAt)
          : "Unknown time",
      }))}
      dealOptions={dealOptions.map((deal) => ({
        id: deal.id,
        label:
          deal.lead?.name || deal.lead?.email || `Deal ${deal.id.slice(0, 8)}`,
      }))}
      invoices={invoiceRows}
      payments={payments
        .filter((payment) => !payment.voidedAt)
        .map((payment) => {
        const isDirect = !payment.invoiceId;
        const invoiceLabel = payment.invoice
          ? `${payment.invoice.invoiceNumber} - ${payment.invoice.title}`
          : payment.standaloneTitle
            ? `${payment.standaloneTitle}${payment.payerName ? ` · ${payment.payerName}` : ""}`
            : "Direct payment";
        return {
          id: payment.id,
          invoiceLabel,
          isDirect,
          amountLabel: `${payment.currency} ${Number(payment.amount).toLocaleString()}`,
          amountValue: Number(payment.amount),
          method: canManage ? payment.method || "—" : "Restricted",
          reference: canManage ? payment.reference || "—" : "Restricted",
          referenceRaw: payment.reference || "",
          paidAtLabel: new Intl.DateTimeFormat("en-NG", {
            dateStyle: "medium",
          }).format(payment.paidAt),
          paidAtValue: payment.paidAt.toISOString().slice(0, 10),
          recordedBy: canManage
            ? payment.recordedByLabel || "Unknown"
            : "Restricted",
          hasAttachment: Boolean(payment.attachmentUrl),
          ...resolveAllocation({
            projectId: payment.projectId,
            unitId: payment.unitId,
            deal: payment.invoice?.deal,
          }),
          incomeType: payment.incomeType,
          voided: Boolean(payment.voidedAt),
          voidReason: payment.voidReason || "",
          canVoid: !payment.voidedAt,
          department: payment.department || payment.invoice?.department || "",
        };
      })}
      expenses={expenses
        .filter((expense) => !expense.voidedAt)
        .map((expense) => ({
        id: expense.id,
        category: expense.category,
        vendorName: expense.vendorName || "—",
        amountLabel: `${expense.currency} ${Number(expense.amount).toLocaleString()}`,
        amountValue: Number(expense.amount),
        pnlAmountValue: expensePnlAmount({
          grossAmount: Number(expense.amount),
          subtotal: Number(expense.subtotal),
          vatRecoverable: expense.vatRecoverable,
        }),
        subtotalValue: Number(expense.subtotal),
        vatAmountValue: Number(expense.vatAmount),
        vatRate: Number(expense.vatRate),
        vatTreatment: expense.vatTreatment,
        vatRecoverable: expense.vatRecoverable,
        currency: expense.currency,
        paidThroughAccount: expense.paidThroughAccount || "—",
        reference: expense.reference || "—",
        referenceRaw: expense.reference || "",
        expenseDateLabel: new Intl.DateTimeFormat("en-NG", {
          dateStyle: "medium",
        }).format(expense.expenseDate),
        expenseDateValue: expense.expenseDate.toISOString().slice(0, 10),
        hasAttachment: Boolean(expense.attachmentUrl),
        projectId: expense.projectId || "",
        projectLabel: expense.projectId
          ? projectMap.get(expense.projectId) || "Unknown project"
          : "Unassigned project",
        unitId: expense.unitId || "",
        unitLabel: expense.unitId
          ? unitMap.get(expense.unitId)?.label || "Unknown unit"
          : "Unassigned unit",
        department: expense.department || "",
        note: expense.note || "",
        voided: Boolean(expense.voidedAt),
        voidReason: expense.voidReason || "",
        canVoid: !expense.voidedAt,
      }))}
      remittances={liveRemittances.map((row) => ({
        id: row.id,
        clientName: row.propertyClient.fullName,
        clientEmail: row.propertyClient.email || "",
        amountLabel: `${row.currency} ${Number(row.amount).toLocaleString()}`,
        amountValue: Number(row.amount),
        currency: row.currency,
        method: canManage ? row.method || "—" : "Restricted",
        reference: canManage ? row.reference || "—" : "Restricted",
        remittedAtLabel: new Intl.DateTimeFormat("en-NG", {
          dateStyle: "medium",
        }).format(row.remittedAt),
        remittedAtValue: row.remittedAt.toISOString().slice(0, 10),
        note: row.note || "",
        recordedBy: canManage ? row.recordedByLabel || "Unknown" : "Restricted",
        projectId: row.projectId || "",
        projectLabel: row.projectId
          ? projectMap.get(row.projectId) || "Unknown project"
          : "Unassigned project",
        unitId: row.unitId || "",
        unitLabel: row.unitId
          ? unitMap.get(row.unitId)?.label || "Unknown unit"
          : "Unassigned unit",
        voided: Boolean(row.voidedAt),
        voidReason: row.voidReason || "",
        canVoid: !row.voidedAt,
      }))}
      remittanceClients={remittanceClients.map((client) => ({
        id: client.id,
        label: client.email
          ? `${client.fullName} · ${client.email}`
          : client.fullName,
      }))}
      salesReceipts={salesReceipts
        .filter((receipt) => !receipt.voidedAt && receipt.status !== "VOID")
        .map((receipt) => ({
        id: receipt.id,
        receiptNumber: receipt.receiptNumber,
        title: receipt.title,
        customerName:
          receipt.customerName ||
          receipt.deal?.propertyClient?.fullName ||
          receipt.deal?.lead?.name ||
          "—",
        defaultEmail:
          receipt.deal?.propertyClient?.email ||
          receipt.deal?.lead?.email ||
          "",
        amountLabel: `${receipt.currency} ${Number(receipt.amount).toLocaleString()}`,
        paymentMode: receipt.paymentMode || "—",
        depositAccount: receipt.depositAccount || "—",
        issuedAtLabel: new Intl.DateTimeFormat("en-NG", {
          dateStyle: "medium",
        }).format(receipt.issuedAt),
        issuedAtValue: receipt.issuedAt.toISOString().slice(0, 10),
        amountValue: Number(receipt.amount),
        ...resolveAllocation(receipt),
        incomeType: receipt.incomeType,
        voided: Boolean(receipt.voidedAt) || receipt.status === "VOID",
        voidReason: receipt.voidReason || "",
        canVoid: !receipt.voidedAt && receipt.status !== "VOID",
        sentToEmail: receipt.sentToEmail,
        sentAtLabel: receipt.sentAt
          ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(
              receipt.sentAt,
            )
          : null,
        pdfUrl: receipt.pdfUrl,
      }))}
      masterLogs={masterLogs.map((log) => ({
        id: log.id,
        timestamp: new Intl.DateTimeFormat("en-NG", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(log.createdAt),
        actor: canManage ? log.actorLabel || "System" : "Restricted",
        module: log.module,
        action: log.action,
        entityType: log.entityType,
        summary: canManage
          ? log.summary || "No summary"
          : `${log.module} ${log.action}`,
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
        modules: Array.from(new Set(allLogValues.map((x) => x.module))).sort(
          (a, b) => a.localeCompare(b),
        ),
        actions: Array.from(new Set(allLogValues.map((x) => x.action))).sort(
          (a, b) => a.localeCompare(b),
        ),
        actors: canManage
          ? Array.from(
              new Set(
                allLogValues
                  .map((x) => x.actorLabel)
                  .filter(Boolean) as string[],
              ),
            ).sort((a, b) => a.localeCompare(b))
          : [],
      }}
      arView={{
        totalOpenInvoices: openInvoices.length,
        overdueInvoices: overdueInvoices.length,
        followUpsNeeded: overdueInvoices.filter(
          (x) => x.reminderCount === 0 || x.overdueDays >= 14,
        ).length,
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
        currency: tenant.defaultCurrency,
        companyName: tenant.name,
        companyLogoUrl: tenant.settings?.logoUrl ?? null,
        generatedAtLabel: new Intl.DateTimeFormat("en-NG", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(now),
        pnlLite: {
          invoicedLabel: `${tenant.defaultCurrency} ${totalInvoiced.toLocaleString()}`,
          collectedLabel: `${tenant.defaultCurrency} ${totalCollected.toLocaleString()}`,
          outstandingLabel: `${tenant.defaultCurrency} ${outstanding.toLocaleString()}`,
        },
        cashflowLite: {
          currentMonthLabel: `${tenant.defaultCurrency} ${currentMonthCash.toLocaleString()}`,
          previousMonthLabel: `${tenant.defaultCurrency} ${previousMonthCash.toLocaleString()}`,
          changeLabel: `${tenant.defaultCurrency} ${(currentMonthCash - previousMonthCash).toLocaleString()}`,
        },
        collections: {
          collectionRateLabel: `${collectionRate.toFixed(1)}%`,
          overdueOutstandingLabel: `${tenant.defaultCurrency} ${overdueOutstanding.toLocaleString()}`,
          overdueCount: overdueInvoices.length,
          remindersSent: invoiceRows.reduce(
            (sum, row) => sum + row.reminderCount,
            0,
          ),
        },
        pnlBreakdown,
        expenseBreakdown,
        cashflowBreakdown,
        balanceSnapshot: {
          receivables: outstanding,
          overdueReceivables: overdueOutstanding,
          cashIn: totalCollected,
          cashOut:
            liveExpenses.reduce((sum, x) => sum + Number(x.amount), 0) +
            liveRemittances.reduce((sum, x) => sum + Number(x.amount), 0),
          netCashflow: operatingNet({
            collected: totalCollected,
            expenses: liveExpenses.reduce((sum, x) => sum + Number(x.amount), 0),
            remitted: liveRemittances.reduce((sum, x) => sum + Number(x.amount), 0),
          }),
        },
        clientBalances: clientDepositRows,
      }}
      bankingRows={bankRows.map((row) => ({
        id: row.id,
        importId: row.importId,
        importSourceName: row.import.sourceName,
        importImportedAt: row.import.importedAt.toISOString(),
        date: row.postedAt ? row.postedAt.toISOString().slice(0, 10) : "",
        description: row.description || "",
        reference: row.reference || "",
        debit: Number(row.debit),
        credit: Number(row.credit),
        amountAbs: Number(row.amountAbs),
        direction: row.direction === "debit" ? "debit" : "credit",
        matchStatus: row.matchStatus,
        matchedEntityType: row.matchedEntityType || null,
        matchedEntityId: row.matchedEntityId || null,
        exceptionReason: row.exceptionReason || null,
        reconciliationNote: row.reconciliationNote || "",
        importIsFinalized: Boolean(row.import.finalizedAt),
      }))}
      bankingImports={bankImports.map((x) => {
        const s = bankStatsMap.get(x.id) || {
          total: 0,
          matched: 0,
          unmatched: 0,
        };
        return {
          id: x.id,
          sourceName: x.sourceName,
          importedAtLabel: new Intl.DateTimeFormat("en-NG", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(x.importedAt),
          totalRows: s.total,
          matchedRows: s.matched,
          unmatchedRows: s.unmatched,
          finalized: Boolean(x.finalizedAt),
        };
      })}
      financeOptions={financeOptions}
      allocationOptions={projects.map((project) => ({
        id: project.id,
        label: project.name,
        units: units
          .filter((unit) => unit.projectId === project.id)
          .map((unit) => ({ id: unit.id, label: unit.label })),
      }))}
      financeControls={financeControls}
      fiscalYear={
        activeFiscalGoal
          ? {
              label: activeFiscalGoal.label,
              start: activeFiscalGoal.fiscalYearStart
                .toISOString()
                .slice(0, 10),
              end: activeFiscalGoal.fiscalYearEnd.toISOString().slice(0, 10),
            }
          : null
      }
      financeVendors={financeVendors}
      financeExpenseCategories={financeExpenseCategories}
      vendorBills={vendorBills.map((bill) => {
        const dueDate = bill.dueDate;
        const isOpen =
          bill.status !== "VOID" &&
          bill.status !== "PAID" &&
          Number(bill.balanceDue) > 0;
        const overdueDays =
          isOpen && dueDate && dueDate.getTime() < startOfToday.getTime()
            ? Math.floor(
                (startOfToday.getTime() - dueDate.getTime()) / MS_PER_DAY,
              )
            : 0;
        return {
          id: bill.id,
          billNumber: bill.billNumber,
          vendorName: bill.vendorName,
          title: bill.title,
          status: formatEnumLabel(bill.status),
          statusValue: bill.status,
          amountLabel: `${bill.currency} ${Number(bill.amount).toLocaleString()}`,
          amountValue: Number(bill.amount),
          balanceLabel: `${bill.currency} ${Number(bill.balanceDue).toLocaleString()}`,
          balanceValue: Number(bill.balanceDue),
          currency: bill.currency,
          dueDateLabel: dueDate
            ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(
                dueDate,
              )
            : "No due date",
          dueDateValue: dueDate ? dueDate.toISOString().slice(0, 10) : "",
          issuedAtValue: bill.issuedAt.toISOString().slice(0, 10),
          department: bill.department || "",
          isOverdue: overdueDays > 0,
          overdueDays,
          canRecordPayment:
            Number(bill.balanceDue) > 0 &&
            bill.status !== "VOID" &&
            bill.status !== "PAID",
          canVoid: bill.status === "OPEN",
          isRecurring: Boolean(bill.isRecurring),
          recurrenceLabel: bill.recurrenceFrequency
            ? bill.recurrenceFrequency === "DAILY"
              ? "Daily"
              : bill.recurrenceFrequency === "WEEKLY"
                ? "Weekly"
                : "Monthly"
            : "",
        };
      })}
    />
  );
}
