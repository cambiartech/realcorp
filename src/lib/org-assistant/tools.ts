import prisma from "@/lib/db";
import type { Prisma } from "@/generated/prisma";

export type AssistantModules = {
  sales: boolean;
  finance: boolean;
  hr: boolean;
  shortlets: boolean;
  tasks: boolean;
};

type Period = { from: Date; to: Date; label: string };

type ToolArgs = Record<string, unknown>;

type ToolDef = {
  name: string;
  description: string;
  module: keyof AssistantModules | null;
  parameters: Record<string, unknown>;
  run: (tenantId: string, args: ToolArgs) => Promise<unknown>;
};

const DAY_MS = 86_400_000;

const PERIOD_PARAMS = {
  from: { type: "STRING", description: "Start date, YYYY-MM-DD. Defaults to 30 days ago." },
  to: { type: "STRING", description: "End date, YYYY-MM-DD (inclusive). Defaults to today." },
};

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

function resolvePeriod(args: ToolArgs): Period {
  const now = new Date();
  const to = parseDate(args.to) ?? now;
  const toEnd = new Date(to);
  toEnd.setHours(23, 59, 59, 999);
  const from = parseDate(args.from) ?? new Date(toEnd.getTime() - 30 * DAY_MS);
  from.setHours(0, 0, 0, 0);
  return { from, to: toEnd, label: `${from.toISOString().slice(0, 10)} to ${toEnd.toISOString().slice(0, 10)}` };
}

function num(value: Prisma.Decimal | number | null | undefined): number {
  if (value == null) return 0;
  return Math.round(Number(value) * 100) / 100;
}

async function userLabels(userIds: Array<string | null>): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (!ids.length) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  });
  return new Map(users.map((u) => [u.id, u.name || u.email || "Unknown"]));
}

const TOOLS: ToolDef[] = [
  {
    name: "get_org_overview",
    description:
      "Headline numbers for the whole organization: people, leads, open deals, outstanding invoices, open tasks, shortlet bookings. Use first for broad questions.",
    module: null,
    parameters: { type: "OBJECT", properties: {} },
    run: async (tenantId) => {
      const now = new Date();
      const [members, leads, openDeals, wonDeals, outstanding, openTasks, overdueTasks, activeStays, projects] =
        await Promise.all([
          prisma.membership.count({ where: { tenantId, status: "ACTIVE" } }),
          prisma.lead.count({ where: { tenantId } }),
          prisma.deal.aggregate({
            where: { tenantId, stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } },
            _count: true,
            _sum: { value: true },
          }),
          prisma.deal.aggregate({ where: { tenantId, stage: "CLOSED_WON" }, _count: true, _sum: { value: true } }),
          prisma.invoice.aggregate({
            where: { tenantId, status: { in: ["SENT", "PARTIALLY_PAID"] } },
            _count: true,
            _sum: { balanceDue: true },
          }),
          prisma.workTask.count({ where: { tenantId, status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] } } }),
          prisma.workTask.count({
            where: { tenantId, status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] }, dueDate: { lt: now } },
          }),
          prisma.shortletReservation.count({ where: { tenantId, status: "CHECKED_IN" } }),
          prisma.project.count({ where: { tenantId } }),
        ]);
      return {
        activeTeamMembers: members,
        projects,
        totalLeads: leads,
        openDeals: { count: openDeals._count, pipelineValue: num(openDeals._sum.value) },
        wonDealsAllTime: { count: wonDeals._count, value: num(wonDeals._sum.value) },
        outstandingInvoices: { count: outstanding._count, balanceDue: num(outstanding._sum.balanceDue) },
        openTasks,
        overdueTasks,
        guestsCheckedInNow: activeStays,
      };
    },
  },
  {
    name: "get_sales_report",
    description:
      "Leads and deals for a period: new leads by source and quality, deals by stage with value, won value, and performance per salesperson.",
    module: "sales",
    parameters: { type: "OBJECT", properties: PERIOD_PARAMS },
    run: async (tenantId, args) => {
      const p = resolvePeriod(args);
      const range = { gte: p.from, lte: p.to };
      const [bySource, byQuality, byStage, wonInPeriod, leadsByOwner, wonByOwner] = await Promise.all([
        prisma.lead.groupBy({ by: ["source"], where: { tenantId, createdAt: range }, _count: true }),
        prisma.lead.groupBy({ by: ["quality"], where: { tenantId, createdAt: range }, _count: true }),
        prisma.deal.groupBy({
          by: ["stage"],
          where: { tenantId, createdAt: range },
          _count: true,
          _sum: { value: true },
        }),
        prisma.deal.aggregate({
          where: { tenantId, stage: "CLOSED_WON", updatedAt: range },
          _count: true,
          _sum: { value: true },
        }),
        prisma.lead.groupBy({ by: ["assignedUserId"], where: { tenantId, createdAt: range }, _count: true }),
        prisma.deal.groupBy({
          by: ["assignedUserId"],
          where: { tenantId, stage: "CLOSED_WON", updatedAt: range },
          _count: true,
          _sum: { value: true },
        }),
      ]);
      const names = await userLabels([
        ...leadsByOwner.map((r) => r.assignedUserId),
        ...wonByOwner.map((r) => r.assignedUserId),
      ]);
      const owner = (id: string | null) => (id ? names.get(id) ?? "Unknown" : "Unassigned");
      return {
        period: p.label,
        newLeads: bySource.reduce((s, r) => s + r._count, 0),
        leadsBySource: bySource.map((r) => ({ source: r.source || "Unknown", count: r._count })),
        leadsByQuality: byQuality.map((r) => ({ quality: r.quality, count: r._count })),
        dealsCreatedByStage: byStage.map((r) => ({ stage: r.stage, count: r._count, value: num(r._sum.value) })),
        dealsWon: { count: wonInPeriod._count, value: num(wonInPeriod._sum.value) },
        leadsPerSalesperson: leadsByOwner.map((r) => ({ salesperson: owner(r.assignedUserId), leads: r._count })),
        wonPerSalesperson: wonByOwner.map((r) => ({
          salesperson: owner(r.assignedUserId),
          deals: r._count,
          value: num(r._sum.value),
        })),
      };
    },
  },
  {
    name: "get_finance_report",
    description:
      "Money in and out for a period: payments received by income type, sales receipts, expenses by category, net position, plus outstanding and overdue invoices today. Amounts are NGN unless stated.",
    module: "finance",
    parameters: { type: "OBJECT", properties: PERIOD_PARAMS },
    run: async (tenantId, args) => {
      const p = resolvePeriod(args);
      const now = new Date();
      const [payments, receipts, expenses, outstanding, overdue] = await Promise.all([
        prisma.paymentRecord.groupBy({
          by: ["incomeType"],
          where: { tenantId, voidedAt: null, paidAt: { gte: p.from, lte: p.to } },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.salesReceipt.aggregate({
          where: { tenantId, voidedAt: null, issuedAt: { gte: p.from, lte: p.to } },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.expense.groupBy({
          by: ["category"],
          where: { tenantId, voidedAt: null, expenseDate: { gte: p.from, lte: p.to } },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.invoice.aggregate({
          where: { tenantId, status: { in: ["SENT", "PARTIALLY_PAID"] } },
          _sum: { balanceDue: true },
          _count: true,
        }),
        prisma.invoice.aggregate({
          where: { tenantId, status: { in: ["SENT", "PARTIALLY_PAID"] }, dueDate: { lt: now } },
          _sum: { balanceDue: true },
          _count: true,
        }),
      ]);
      const paymentsTotal = payments.reduce((s, r) => s + num(r._sum.amount), 0);
      const expensesTotal = expenses.reduce((s, r) => s + num(r._sum.amount), 0);
      return {
        period: p.label,
        paymentsReceived: {
          total: paymentsTotal,
          byIncomeType: payments.map((r) => ({ incomeType: r.incomeType, amount: num(r._sum.amount), count: r._count })),
        },
        salesReceipts: { total: num(receipts._sum.amount), count: receipts._count },
        expenses: {
          total: expensesTotal,
          byCategory: expenses
            .map((r) => ({ category: r.category, amount: num(r._sum.amount), count: r._count }))
            .sort((a, b) => b.amount - a.amount),
        },
        netCashPosition: paymentsTotal - expensesTotal,
        outstandingInvoicesToday: { count: outstanding._count, balanceDue: num(outstanding._sum.balanceDue) },
        overdueInvoicesToday: { count: overdue._count, balanceDue: num(overdue._sum.balanceDue) },
      };
    },
  },
  {
    name: "get_hr_report",
    description:
      "People and payroll: headcount by department and status, and totals (gross, net, tax, pension, paid count) for the latest payroll runs.",
    module: "hr",
    parameters: {
      type: "OBJECT",
      properties: { runs: { type: "INTEGER", description: "How many recent payroll months to include (1-12). Default 3." } },
    },
    run: async (tenantId, args) => {
      const take = Math.min(Math.max(Number(args.runs) || 3, 1), 12);
      const [byStatus, byDepartment, runs] = await Promise.all([
        prisma.employeeProfile.groupBy({ by: ["status"], where: { tenantId }, _count: true }),
        prisma.employeeProfile.groupBy({ by: ["department"], where: { tenantId, status: "ACTIVE" }, _count: true }),
        prisma.hrPayslipRun.findMany({
          where: { tenantId },
          orderBy: [{ year: "desc" }, { month: "desc" }],
          take,
          select: { id: true, label: true, status: true },
        }),
      ]);
      const totals = await Promise.all(
        runs.map(async (run) => {
          const [sum, paid] = await Promise.all([
            prisma.hrPayslip.aggregate({
              where: { runId: run.id },
              _sum: { grossPay: true, netPay: true, payeeTax: true, pensionDeduction: true, employerCost: true },
              _count: true,
            }),
            prisma.hrPayslip.count({ where: { runId: run.id, paymentStatus: "PAID" } }),
          ]);
          return {
            month: run.label,
            status: run.status,
            payslips: sum._count,
            paid,
            gross: num(sum._sum.grossPay),
            net: num(sum._sum.netPay),
            payeTax: num(sum._sum.payeeTax),
            pension: num(sum._sum.pensionDeduction),
            employerCost: num(sum._sum.employerCost),
          };
        }),
      );
      return {
        employeesByStatus: byStatus.map((r) => ({ status: r.status, count: r._count })),
        activeByDepartment: byDepartment.map((r) => ({ department: r.department || "Unassigned", count: r._count })),
        payrollRuns: totals,
      };
    },
  },
  {
    name: "get_shortlets_report",
    description:
      "Short-let bookings for a period (by check-in date): reservations by status and source, booked revenue, amount paid, balance owed, caution fees, nights, and a per-property breakdown.",
    module: "shortlets",
    parameters: { type: "OBJECT", properties: PERIOD_PARAMS },
    run: async (tenantId, args) => {
      const p = resolvePeriod(args);
      const where = { tenantId, checkIn: { gte: p.from, lte: p.to } };
      const live = { ...where, status: { notIn: ["CANCELLED", "NO_SHOW"] as ("CANCELLED" | "NO_SHOW")[] } };
      const [byStatus, bySource, totals, byProperty, units] = await Promise.all([
        prisma.shortletReservation.groupBy({ by: ["status"], where, _count: true }),
        prisma.shortletReservation.groupBy({ by: ["source"], where: live, _count: true }),
        prisma.shortletReservation.aggregate({
          where: live,
          _sum: { totalAmount: true, amountPaid: true, balanceDue: true, nights: true, cautionFee: true, cautionFeePaid: true },
          _count: true,
        }),
        prisma.shortletReservation.groupBy({
          by: ["propertyId"],
          where: live,
          _sum: { totalAmount: true, nights: true },
          _count: true,
        }),
        prisma.shortletUnit.count({ where: { tenantId } }),
      ]);
      const propIds = byProperty.map((r) => r.propertyId).filter((id): id is string => Boolean(id));
      const props = propIds.length
        ? await prisma.shortletProperty.findMany({ where: { id: { in: propIds } }, select: { id: true, name: true } })
        : [];
      const propName = new Map(props.map((x) => [x.id, x.name]));
      const days = Math.max(1, Math.round((p.to.getTime() - p.from.getTime()) / DAY_MS));
      const nights = totals._sum.nights ?? 0;
      return {
        period: p.label,
        reservationsByStatus: byStatus.map((r) => ({ status: r.status, count: r._count })),
        bookingsBySource: bySource.map((r) => ({ source: r.source, count: r._count })),
        bookings: totals._count,
        bookedRevenue: num(totals._sum.totalAmount),
        amountPaid: num(totals._sum.amountPaid),
        balanceOwed: num(totals._sum.balanceDue),
        cautionFees: { charged: num(totals._sum.cautionFee), collected: num(totals._sum.cautionFeePaid) },
        nightsBooked: nights,
        units,
        approxOccupancyPercent: units ? Math.round((nights / (units * days)) * 1000) / 10 : null,
        byProperty: byProperty.map((r) => ({
          property: r.propertyId ? propName.get(r.propertyId) ?? "Unknown" : "No property",
          bookings: r._count,
          revenue: num(r._sum.totalAmount),
          nights: r._sum.nights ?? 0,
        })),
      };
    },
  },
  {
    name: "get_tasks_report",
    description: "Work tasks: counts by status and priority, overdue tasks, tasks completed in a period, and open/overdue per person.",
    module: "tasks",
    parameters: { type: "OBJECT", properties: PERIOD_PARAMS },
    run: async (tenantId, args) => {
      const p = resolvePeriod(args);
      const now = new Date();
      const open = { tenantId, status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] as ("TODO" | "IN_PROGRESS" | "IN_REVIEW")[] } };
      const [byStatus, byPriority, completed, openByPerson, overdueByPerson] = await Promise.all([
        prisma.workTask.groupBy({ by: ["status"], where: { tenantId }, _count: true }),
        prisma.workTask.groupBy({ by: ["priority"], where: open, _count: true }),
        prisma.workTask.count({ where: { tenantId, status: "DONE", completedAt: { gte: p.from, lte: p.to } } }),
        prisma.workTask.groupBy({ by: ["assigneeUserId"], where: open, _count: true }),
        prisma.workTask.groupBy({ by: ["assigneeUserId"], where: { ...open, dueDate: { lt: now } }, _count: true }),
      ]);
      const names = await userLabels(openByPerson.map((r) => r.assigneeUserId));
      const overdueMap = new Map(overdueByPerson.map((r) => [r.assigneeUserId, r._count]));
      return {
        period: p.label,
        byStatus: byStatus.map((r) => ({ status: r.status, count: r._count })),
        openByPriority: byPriority.map((r) => ({ priority: r.priority, count: r._count })),
        completedInPeriod: completed,
        perPerson: openByPerson
          .map((r) => ({
            person: r.assigneeUserId ? names.get(r.assigneeUserId) ?? "Unknown" : "Unassigned",
            open: r._count,
            overdue: overdueMap.get(r.assigneeUserId) ?? 0,
          }))
          .sort((a, b) => b.overdue - a.overdue || b.open - a.open),
      };
    },
  },
  {
    name: "list_records",
    description:
      "List individual records (up to 25) when the user asks 'which ones' or wants names: recent_leads, open_deals, overdue_invoices, largest_expenses, upcoming_checkins, overdue_tasks.",
    module: null,
    parameters: {
      type: "OBJECT",
      properties: {
        kind: {
          type: "STRING",
          enum: ["recent_leads", "open_deals", "overdue_invoices", "largest_expenses", "upcoming_checkins", "overdue_tasks"],
        },
        limit: { type: "INTEGER", description: "1-25. Default 10." },
        ...PERIOD_PARAMS,
      },
      required: ["kind"],
    },
    run: async (tenantId, args) => {
      const take = Math.min(Math.max(Number(args.limit) || 10, 1), 25);
      const now = new Date();
      switch (args.kind) {
        case "recent_leads": {
          const rows = await prisma.lead.findMany({
            where: { tenantId },
            orderBy: { createdAt: "desc" },
            take,
            select: { name: true, source: true, quality: true, projectInterest: true, budgetRange: true, createdAt: true, assignedUserId: true },
          });
          const names = await userLabels(rows.map((r) => r.assignedUserId));
          return rows.map((r) => ({
            name: r.name || "No name",
            source: r.source,
            quality: r.quality,
            interest: r.projectInterest,
            budget: r.budgetRange,
            created: r.createdAt.toISOString().slice(0, 10),
            owner: r.assignedUserId ? names.get(r.assignedUserId) : "Unassigned",
          }));
        }
        case "open_deals": {
          const rows = await prisma.deal.findMany({
            where: { tenantId, stage: { notIn: ["CLOSED_WON", "CLOSED_LOST"] } },
            orderBy: { value: "desc" },
            take,
            select: { stage: true, value: true, updatedAt: true, assignedUserId: true, lead: { select: { name: true } } },
          });
          const names = await userLabels(rows.map((r) => r.assignedUserId));
          return rows.map((r) => ({
            client: r.lead?.name || "No name",
            stage: r.stage,
            value: num(r.value),
            lastUpdated: r.updatedAt.toISOString().slice(0, 10),
            owner: r.assignedUserId ? names.get(r.assignedUserId) : "Unassigned",
          }));
        }
        case "overdue_invoices": {
          const rows = await prisma.invoice.findMany({
            where: { tenantId, status: { in: ["SENT", "PARTIALLY_PAID"] }, dueDate: { lt: now } },
            orderBy: { balanceDue: "desc" },
            take,
            select: { invoiceNumber: true, title: true, amount: true, balanceDue: true, dueDate: true },
          });
          return rows.map((r) => ({
            invoice: r.invoiceNumber,
            title: r.title,
            amount: num(r.amount),
            balanceDue: num(r.balanceDue),
            daysOverdue: r.dueDate ? Math.floor((now.getTime() - r.dueDate.getTime()) / DAY_MS) : null,
          }));
        }
        case "largest_expenses": {
          const p = resolvePeriod(args);
          const rows = await prisma.expense.findMany({
            where: { tenantId, voidedAt: null, expenseDate: { gte: p.from, lte: p.to } },
            orderBy: { amount: "desc" },
            take,
            select: { category: true, vendorName: true, amount: true, expenseDate: true, department: true },
          });
          return rows.map((r) => ({
            category: r.category,
            vendor: r.vendorName,
            department: r.department,
            amount: num(r.amount),
            date: r.expenseDate.toISOString().slice(0, 10),
          }));
        }
        case "upcoming_checkins": {
          const rows = await prisma.shortletReservation.findMany({
            where: { tenantId, checkIn: { gte: now }, status: { in: ["PENDING", "CONFIRMED", "RESERVED"] } },
            orderBy: { checkIn: "asc" },
            take,
            select: { guestName: true, checkIn: true, nights: true, totalAmount: true, balanceDue: true, unit: { select: { name: true } } },
          });
          return rows.map((r) => ({
            guest: r.guestName,
            unit: r.unit?.name,
            checkIn: r.checkIn.toISOString().slice(0, 10),
            nights: r.nights,
            total: num(r.totalAmount),
            balanceDue: num(r.balanceDue),
          }));
        }
        case "overdue_tasks": {
          const rows = await prisma.workTask.findMany({
            where: { tenantId, status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] }, dueDate: { lt: now } },
            orderBy: { dueDate: "asc" },
            take,
            select: { title: true, priority: true, status: true, dueDate: true, assigneeUserId: true },
          });
          const names = await userLabels(rows.map((r) => r.assigneeUserId));
          return rows.map((r) => ({
            task: r.title,
            priority: r.priority,
            status: r.status,
            due: r.dueDate?.toISOString().slice(0, 10),
            assignee: r.assigneeUserId ? names.get(r.assigneeUserId) : "Unassigned",
          }));
        }
        default:
          return { error: "Unknown record kind." };
      }
    },
  },
];

export function assistantTools(modules: AssistantModules): ToolDef[] {
  return TOOLS.filter((t) => t.module === null || modules[t.module]);
}

export function toolDeclarations(tools: ToolDef[]) {
  return tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters }));
}

/** OpenAI / Anthropic / Groq want lowercase JSON Schema types. */
function toJsonSchema(node: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "type" && typeof value === "string") {
      out.type = value.toLowerCase();
    } else if (key === "properties" && value && typeof value === "object" && !Array.isArray(value)) {
      out.properties = Object.fromEntries(
        Object.entries(value as Record<string, Record<string, unknown>>).map(([k, v]) => [k, toJsonSchema(v)]),
      );
    } else if (key === "items" && value && typeof value === "object" && !Array.isArray(value)) {
      out.items = toJsonSchema(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function openAiToolDeclarations(tools: ToolDef[]) {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: toJsonSchema(t.parameters),
    },
  }));
}

export function anthropicToolDeclarations(tools: ToolDef[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: toJsonSchema(t.parameters),
  }));
}

const RECORD_KIND_MODULE: Record<string, keyof AssistantModules> = {
  recent_leads: "sales",
  open_deals: "sales",
  overdue_invoices: "finance",
  largest_expenses: "finance",
  upcoming_checkins: "shortlets",
  overdue_tasks: "tasks",
};

export async function runAssistantTool(
  tools: ToolDef[],
  modules: AssistantModules,
  tenantId: string,
  name: string,
  args: ToolArgs,
): Promise<unknown> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) return { error: `Tool ${name} is not available for this organization.` };
  if (name === "list_records") {
    const mod = RECORD_KIND_MODULE[String(args?.kind)];
    if (mod && !modules[mod]) return { error: "That module is switched off for this organization." };
  }
  try {
    return await tool.run(tenantId, args ?? {});
  } catch (error) {
    console.error("Org assistant tool failed.", { name, error });
    return { error: "This data could not be loaded right now." };
  }
}
