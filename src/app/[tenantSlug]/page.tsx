import { auth } from "@/auth";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import { isPortalOnlyRole } from "@/lib/tenant-nav-access";
import prisma from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { DashboardWorkspace } from "./dashboard/dashboard-workspace";
import { loadHrOnboardingStatusForUser } from "@/lib/hr-pending-forms";
import {
  dashboardRoleViewForMembership,
  normalizeLegacyDashboardRoleView,
  type DashboardRoleView,
} from "@/lib/org-membership-profile";
import { buildOrgSetupSteps, orgSetupProgress } from "@/lib/org-setup-checklist";
import { loadHrDashboardMetrics } from "@/lib/hr-dashboard-metrics";

export const dynamic = "force-dynamic";

export default async function TenantHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams?: Promise<{ openGoals?: string }>;
}) {
  const { tenantSlug } = await params;
  const sp = searchParams ? await searchParams : {};
  const session = await auth();

  if (!session?.user?.id) {
    notFound();
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      defaultCurrency: true,
      settings: {
        select: {
          moduleSales: true,
          moduleFinance: true,
          moduleMarketing: true,
          moduleCommunity: true,
          roleModuleGrants: true,
          metaPageAccessToken: true,
          whatsappAccessToken: true,
          whatsappPhoneNumberId: true,
          termiiApiKey: true,
          moduleTasks: true,
          moduleHr: true,
          logoUrl: true,
          orgEmail: true,
          orgPhone: true,
          financeCurrencies: true,
          financeBankAccounts: true,
          financePaymentModes: true,
        },
      },
    },
  });

  if (!tenant) {
    notFound();
  }

  const membership = await prisma.membership.findUnique({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: session.user.id,
      },
    },
    select: { role: true, status: true, tenantId: true, department: true, isDepartmentLead: true, modulePermissions: true },
  });
  const isActive = membership?.status === MembershipStatus.ACTIVE;
  const canView = Boolean(session.user.isPlatformAdmin) || isActive;
  if (!canView) notFound();
  // Investors / listing owners land on their portfolio, not the sales dashboard
  if (!session.user.isPlatformAdmin && isPortalOnlyRole(membership?.role)) {
    redirect(`/${tenantSlug}/portal`);
  }
  assertTenantNavAccess(session, membership, tenant.settings, "dashboard");

  const role = (membership?.role || MembershipRole.SALES_EXECUTIVE) as MembershipRole;
  const userDashboardView = dashboardRoleViewForMembership(role, {
    isPlatformAdmin: Boolean(session.user.isPlatformAdmin),
    department: membership?.department,
    isDepartmentLead: membership?.isDepartmentLead,
  });

  const allRoleViews: DashboardRoleView[] = [
    "ORG_ADMIN",
    "FINANCE",
    "SALES_MANAGER",
    "SALES",
    "HR",
    "MARKETING",
    "COMMUNITY",
    "OPERATIONS",
  ];

  const roleOptions: DashboardRoleView[] =
    session.user.isPlatformAdmin || role === MembershipRole.ORG_ADMIN
      ? allRoleViews
      : [userDashboardView];

  const normalizeRoleView = (value?: string | null): DashboardRoleView => {
    const legacy = normalizeLegacyDashboardRoleView(value);
    if (legacy && allRoleViews.includes(legacy)) return legacy;
    return userDashboardView;
  };

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);

  const moduleTasksEnabled = tenant.settings?.moduleTasks ?? true;
  const moduleHrEnabled = tenant.settings?.moduleHr ?? false;
  const canManageOrgSetup = Boolean(session.user.isPlatformAdmin) || role === MembershipRole.ORG_ADMIN;

  const [
    goal,
    preference,
    deals,
    units,
    leads,
    invoices,
    payments,
    users,
    projects,
    activitiesCount,
    whatsappCount,
    inboundWebhookLastAt,
    hrOnboardingStatus,
    myWorkTasksRaw,
    activeMemberCount,
    pendingInviteCount,
  ] = await Promise.all([
    prisma.tenantGoal.findFirst({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.dashboardPreference.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
      select: { roleView: true, widgetConfig: true },
    }),
    prisma.deal.findMany({
      where: { tenantId: tenant.id },
      include: {
        lead: {
          select: {
            id: true,
            source: true,
            projectInterest: true,
          },
        },
        unit: {
          select: {
            project: {
              select: { id: true, name: true },
            },
          },
        },
      },
      take: 1000,
    }),
    prisma.unit.findMany({
      where: { tenantId: tenant.id },
      select: { status: true },
      take: 2000,
    }),
    prisma.lead.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        assignedUserId: true,
        createdAt: true,
        source: true,
        projectInterest: true,
        name: true,
        email: true,
      },
      take: 2000,
    }),
    prisma.invoice.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        amount: true,
        balanceDue: true,
        currency: true,
        dueDate: true,
        issuedAt: true,
        createdAt: true,
        deal: {
          select: {
            assignedUserId: true,
            unit: {
              select: {
                project: {
                  select: { id: true, name: true },
                },
              },
            },
            lead: {
              select: { projectInterest: true },
            },
          },
        },
      },
      take: 2000,
    }),
    prisma.paymentRecord.findMany({
      where: { tenantId: tenant.id, voidedAt: null },
      select: {
        id: true,
        invoiceId: true,
        standaloneTitle: true,
        amount: true,
        currency: true,
        paidAt: true,
        method: true,
        reference: true,
        recordedByUserId: true,
        recordedByLabel: true,
        invoice: {
          select: {
            invoiceNumber: true,
            deal: {
              select: {
                assignedUserId: true,
                unit: {
                  select: {
                    project: {
                      select: { id: true, name: true },
                    },
                  },
                },
                lead: {
                  select: { projectInterest: true },
                },
              },
            },
          },
        },
      },
      take: 4000,
    }),
    prisma.membership.findMany({
      where: { tenantId: tenant.id, status: MembershipStatus.ACTIVE },
      include: { user: { select: { id: true, name: true, email: true } } },
      take: 500,
    }),
    prisma.project.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true, createdAt: true },
      take: 500,
    }),
    prisma.activity.count({ where: { tenantId: tenant.id } }),
    prisma.whatsAppMessage.count({ where: { tenantId: tenant.id } }),
    prisma.auditLog.findFirst({
      where: { tenantId: tenant.id, entityType: "WHATSAPP_WEBHOOK", action: "RECEIVED" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    loadHrOnboardingStatusForUser(tenant.id, session.user.id, session.user.email),
    moduleTasksEnabled
      ? prisma.workTask.findMany({
          where: {
            tenantId: tenant.id,
            status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] },
            OR: [{ assigneeUserId: session.user.id }, { createdByUserId: session.user.id }],
          },
          orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
          include: { space: { select: { name: true } } },
          take: 8,
        })
      : Promise.resolve([]),
    prisma.membership.count({
      where: { tenantId: tenant.id, status: MembershipStatus.ACTIVE },
    }),
    prisma.invitation.count({
      where: { tenantId: tenant.id, acceptedAt: null, expiresAt: { gt: new Date() } },
    }),
  ]);

  const hrMetrics = await loadHrDashboardMetrics(tenant.id, tenantSlug, moduleHrEnabled);

  const orgSetupSteps = buildOrgSetupSteps({
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    defaultCurrency: tenant.defaultCurrency || "NGN",
    logoUrl: tenant.settings?.logoUrl ?? null,
    orgEmail: tenant.settings?.orgEmail ?? null,
    orgPhone: tenant.settings?.orgPhone ?? null,
    financeCurrencies: tenant.settings?.financeCurrencies,
    financeBankAccounts: tenant.settings?.financeBankAccounts,
    financePaymentModes: tenant.settings?.financePaymentModes,
    moduleFinance: tenant.settings?.moduleFinance ?? true,
    activeMemberCount,
    pendingInviteCount,
    hasActiveFiscalGoal: Boolean(goal),
  });
  const orgSetup = orgSetupProgress(orgSetupSteps);

  const preferredRoleView = normalizeRoleView(preference?.roleView || roleOptions[0]);
  const effectiveRoleView = roleOptions.includes(preferredRoleView as (typeof roleOptions)[number])
    ? preferredRoleView
    : roleOptions[0];
  const defaultWidgetIds = Array.isArray(preference?.widgetConfig)
    ? preference?.widgetConfig.filter((x): x is string => typeof x === "string")
    : [];

  const revenueMtd = payments
    .filter((p) => p.paidAt >= monthStart && p.paidAt < monthEnd)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const pipelineOpen = deals
    .filter((d) => d.stage !== "CLOSED_WON" && d.stage !== "CLOSED_LOST")
    .reduce((sum, d) => sum + Number(d.value || 0), 0);
  const pendingFinanceCount = deals.filter((d) => d.pendingFinance).length;
  const reservedUnits = units.filter((u) => u.status === "RESERVED").length;
  const soldUnits = units.filter((u) => u.status === "SOLD").length;
  const availableUnits = units.filter((u) => u.status === "AVAILABLE").length;
  const expectedThisMonth = invoices
    .filter((inv) => inv.dueDate && inv.dueDate >= monthStart && inv.dueDate < monthEnd)
    .reduce((sum, inv) => sum + Number(inv.balanceDue), 0);
  const overdueInvoices = invoices.filter(
    (inv) => inv.dueDate && inv.dueDate < new Date() && Number(inv.balanceDue) > 0,
  );
  const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + Number(inv.balanceDue), 0);
  const overdueCount = overdueInvoices.length;
  const pendingVerificationCount = pendingFinanceCount;
  const invoicesMtdCount = invoices.filter(
    (inv) => inv.createdAt >= monthStart && inv.createdAt < monthEnd,
  ).length;
  const teamPipelineCount = deals.filter((d) => d.stage !== "CLOSED_WON" && d.stage !== "CLOSED_LOST").length;
  const unassignedLeads = leads.filter((l) => !l.assignedUserId).length;
  const myPipelineCount = deals.filter(
    (d) => d.assignedUserId === session.user.id && d.stage !== "CLOSED_WON" && d.stage !== "CLOSED_LOST",
  ).length;
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const myNewLeads7d = leads.filter(
    (l) => l.assignedUserId === session.user.id && l.createdAt >= weekAgo,
  ).length;

  const stageOrder = ["NEW_LEAD", "CONTACTED", "QUALIFIED", "NEGOTIATION", "RESERVATION_MADE"];
  const leadFunnel = stageOrder.map((stage) => ({
    stage: stage.replaceAll("_", " "),
    count: deals.filter((d) => d.stage === stage).length,
  }));
  const userMap = new Map(users.map((u) => [u.user.id, u.user.name || u.user.email || u.user.id]));
  const taskStatusLabel: Record<string, string> = {
    TODO: "To-do",
    IN_PROGRESS: "In progress",
    IN_REVIEW: "In review",
    DONE: "Complete",
  };
  const myWorkTasks = moduleTasksEnabled
    ? myWorkTasksRaw.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        statusLabel: taskStatusLabel[t.status] || t.status,
        priority: t.priority,
        dueDateLabel: t.dueDate
          ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(t.dueDate)
          : null,
        spaceName: t.space?.name || null,
        isAssignee: t.assigneeUserId === session.user.id,
        isOwner: t.createdByUserId === session.user.id,
      }))
    : [];
  const myOpenTaskCount = myWorkTasks.length;
  const leaderboardByUser = new Map<string, number>();
  for (const d of deals) {
    if (d.stage !== "CLOSED_WON" || !d.assignedUserId) continue;
    leaderboardByUser.set(
      d.assignedUserId,
      (leaderboardByUser.get(d.assignedUserId) || 0) + Number(d.value || 0),
    );
  }
  const leaderboard = Array.from(leaderboardByUser.entries())
    .map(([id, value]) => ({ label: userMap.get(id) || "Unknown", value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const velocityStages = [
    "NEW_LEAD",
    "CONTACTED",
    "QUALIFIED",
    "INSPECTION_BOOKED",
    "INSPECTION_COMPLETED",
    "NEGOTIATION",
    "RESERVATION_MADE",
  ] as const;
  const stageVelocity = velocityStages.map((stage, idx) => {
    const stageDeals = deals.filter((d) => d.stage === stage);
    const avgDays =
      stageDeals.length > 0
        ? stageDeals.reduce((sum, d) => sum + (Date.now() - d.createdAt.getTime()) / 86_400_000, 0) /
          stageDeals.length
        : 0;
    const nextStage = velocityStages[idx + 1];
    const nextCount = nextStage ? deals.filter((d) => d.stage === nextStage).length : 0;
    const dropOffPct =
      stageDeals.length > 0 ? Math.max(0, ((stageDeals.length - nextCount) / stageDeals.length) * 100) : 0;
    return {
      stage: stage.replaceAll("_", " "),
      avgDays: Number(avgDays.toFixed(1)),
      dropOffPct: Number(dropOffPct.toFixed(1)),
    };
  });

  const leadSourceMap = new Map<string, { leads: number; wonDeals: number; wonValue: number }>();
  for (const lead of leads) {
    const source = lead.source || "Unknown";
    const curr = leadSourceMap.get(source) || { leads: 0, wonDeals: 0, wonValue: 0 };
    curr.leads += 1;
    leadSourceMap.set(source, curr);
  }
  for (const deal of deals) {
    const source = deal.lead?.source || "Unknown";
    const curr = leadSourceMap.get(source) || { leads: 0, wonDeals: 0, wonValue: 0 };
    if (deal.stage === "CLOSED_WON") {
      curr.wonDeals += 1;
      curr.wonValue += Number(deal.value || 0);
    }
    leadSourceMap.set(source, curr);
  }
  const leadSourceQuality = Array.from(leadSourceMap.entries())
    .map(([source, x]) => ({
      source,
      leads: x.leads,
      wonDeals: x.wonDeals,
      winRate: x.leads > 0 ? Number(((x.wonDeals / x.leads) * 100).toFixed(1)) : 0,
      wonValue: x.wonValue,
    }))
    .sort((a, b) => b.winRate - a.winRate || b.wonValue - a.wonValue)
    .slice(0, 6);

  const projectIntelMap = new Map<string, { leads: number; dealValue: number; wonDeals: number }>();
  for (const project of projects) {
    projectIntelMap.set(project.name, { leads: 0, dealValue: 0, wonDeals: 0 });
  }
  for (const lead of leads) {
    const projectName = lead.projectInterest || "Unspecified";
    const curr = projectIntelMap.get(projectName) || { leads: 0, dealValue: 0, wonDeals: 0 };
    curr.leads += 1;
    projectIntelMap.set(projectName, curr);
  }
  for (const deal of deals) {
    const projectName = deal.unit?.project?.name || deal.lead?.projectInterest || "Unspecified";
    const curr = projectIntelMap.get(projectName) || { leads: 0, dealValue: 0, wonDeals: 0 };
    curr.dealValue += Number(deal.value || 0);
    if (deal.stage === "CLOSED_WON") curr.wonDeals += 1;
    projectIntelMap.set(projectName, curr);
  }
  const topProjectsIntelligence = Array.from(projectIntelMap.entries())
    .map(([project, x]) => ({
      project,
      leads: x.leads,
      dealValue: x.dealValue,
      conversionRate: x.leads > 0 ? Number(((x.wonDeals / x.leads) * 100).toFixed(1)) : 0,
    }))
    .filter((x) => x.project !== "Unspecified" || x.leads > 0 || x.dealValue > 0)
    .sort((a, b) => b.dealValue - a.dealValue)
    .slice(0, 6);

  const repNow = new Date();
  const currentStart = new Date(repNow);
  currentStart.setDate(currentStart.getDate() - 30);
  const previousStart = new Date(repNow);
  previousStart.setDate(previousStart.getDate() - 60);
  const repCurrent = new Map<string, number>();
  const repPrevious = new Map<string, number>();
  for (const deal of deals) {
    if (deal.stage !== "CLOSED_WON" || !deal.assignedUserId) continue;
    const v = Number(deal.value || 0);
    if (deal.createdAt >= currentStart) {
      repCurrent.set(deal.assignedUserId, (repCurrent.get(deal.assignedUserId) || 0) + v);
    } else if (deal.createdAt >= previousStart && deal.createdAt < currentStart) {
      repPrevious.set(deal.assignedUserId, (repPrevious.get(deal.assignedUserId) || 0) + v);
    }
  }
  const repIds = new Set([...repCurrent.keys(), ...repPrevious.keys()]);
  const repLeaderboardTrend = Array.from(repIds)
    .map((id) => {
      const current = repCurrent.get(id) || 0;
      const previous = repPrevious.get(id) || 0;
      const deltaPct = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
      return {
        label: userMap.get(id) || "Unknown",
        current,
        previous,
        deltaPct: Number(deltaPct.toFixed(1)),
      };
    })
    .sort((a, b) => b.current - a.current)
    .slice(0, 8);

  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const revenueMonthly = Array.from({ length: 12 }).map((_, idx) => {
    const offset = 11 - idx;
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    start.setMonth(start.getMonth() - offset);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    const value = payments
      .filter((p) => p.paidAt >= start && p.paidAt < end)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    return {
      label: monthLabels[start.getMonth()],
      month: start.getMonth() + 1,
      year: start.getFullYear(),
      value,
    };
  });
  const monthlyPipelineTarget = goal?.pipelineTarget ? Number(goal.pipelineTarget) / 12 : 0;
  const pipelineVsTargetMonthly = Array.from({ length: 12 }).map((_, idx) => {
    const offset = 11 - idx;
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    start.setMonth(start.getMonth() - offset);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    const pipeline = deals
      .filter((d) => d.createdAt >= start && d.createdAt < end && d.stage !== "CLOSED_LOST")
      .reduce((sum, d) => sum + Number(d.value || 0), 0);
    return {
      label: monthLabels[start.getMonth()],
      month: start.getMonth() + 1,
      year: start.getFullYear(),
      pipeline,
      target: monthlyPipelineTarget,
    };
  });

  const startOfWeek = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Monday as week start
    d.setDate(d.getDate() + diff);
    return d;
  };
  const weekStartNow = startOfWeek(new Date());
  const revenueWeekly = Array.from({ length: 16 }).map((_, idx) => {
    const offset = 15 - idx;
    const start = new Date(weekStartNow);
    start.setDate(start.getDate() - offset * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const value = payments
      .filter((p) => p.paidAt >= start && p.paidAt < end)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    return {
      label: `Wk ${start.toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}`,
      value,
    };
  });
  const weeklyPipelineTarget = goal?.pipelineTarget ? Number(goal.pipelineTarget) / 52 : 0;
  const pipelineVsTargetWeekly = Array.from({ length: 16 }).map((_, idx) => {
    const offset = 15 - idx;
    const start = new Date(weekStartNow);
    start.setDate(start.getDate() - offset * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const pipeline = deals
      .filter((d) => d.createdAt >= start && d.createdAt < end && d.stage !== "CLOSED_LOST")
      .reduce((sum, d) => sum + Number(d.value || 0), 0);
    return {
      label: `Wk ${start.toLocaleDateString("en-NG", { day: "2-digit", month: "short" })}`,
      pipeline,
      target: weeklyPipelineTarget,
    };
  });

  return (
    <DashboardWorkspace
      key={tenant.slug}
      tenantSlug={tenant.slug}
      tenantName={tenant.name}
      roleViewOptions={roleOptions}
      initialRoleView={effectiveRoleView}
      initialWidgetIds={defaultWidgetIds}
      goal={
        goal
          ? {
              label: goal.label,
              fiscalYearStart: goal.fiscalYearStart.toISOString().slice(0, 10),
              fiscalYearEnd: goal.fiscalYearEnd.toISOString().slice(0, 10),
              revenueTarget: goal.revenueTarget ? Number(goal.revenueTarget) : null,
              pipelineTarget: goal.pipelineTarget ? Number(goal.pipelineTarget) : null,
            }
          : null
      }
      canManageGoals={
        Boolean(session.user.isPlatformAdmin) ||
        (isActive && (role === MembershipRole.ORG_ADMIN || role === MembershipRole.FINANCE_MANAGER))
      }
      canManageOrgSetup={canManageOrgSetup}
      orgSetupSteps={orgSetup.steps}
      orgSetupCriticalComplete={orgSetup.criticalComplete}
      orgSetupPercent={orgSetup.percent}
      userId={session.user.id}
      initialOpenGoals={sp.openGoals === "1"}
      values={{
        revenueMtd,
        pipelineOpen,
        pendingFinanceCount,
        reservedUnits,
        soldUnits,
        availableUnits,
        expectedThisMonth,
        overdueAmount,
        overdueCount,
        pendingVerificationCount,
        invoicesMtdCount,
        teamPipelineCount,
        unassignedLeads,
        myPipelineCount,
        myNewLeads7d,
        myOpenTaskCount,
        myWorkTasks,
        tasksModuleEnabled: moduleTasksEnabled,
        tasksPageUrl: `/${tenantSlug}/tasks?view=my`,
        hrModuleEnabled: hrMetrics.enabled,
        hrPageUrl: hrMetrics.hrPageUrl,
        hrPeriodLabel: hrMetrics.periodLabel,
        hrTeamSnapshot: {
          activeMemberCount: hrMetrics.activeMemberCount,
          pendingInviteCount: hrMetrics.pendingInviteCount,
          employeeProfileCount: hrMetrics.employeeProfileCount,
          activeEmployeeCount: hrMetrics.activeEmployeeCount,
        },
        hrTopPerformers: hrMetrics.topPerformers,
        hrPendingFormCount: hrMetrics.pendingFormCount,
        hrPendingLeaveCount: hrMetrics.pendingLeaveCount,
        hrOpenAppraisalCount: hrMetrics.openAppraisalCount,
        leadFunnel,
        leaderboard,
        revenueMonthly,
        pipelineVsTargetMonthly,
        revenueWeekly,
        pipelineVsTargetWeekly,
        stageVelocity,
        leadSourceQuality,
        topProjectsIntelligence,
        repLeaderboardTrend,
        hrOnboarding:
          hrOnboardingStatus.summary.state === "pending"
            ? {
                state: "pending" as const,
                pendingCount: hrOnboardingStatus.summary.pendingCount,
                sectionLabels: hrOnboardingStatus.summary.sectionLabels,
                dueLabel: hrOnboardingStatus.summary.dueLabel,
                masterUrl: hrOnboardingStatus.summary.masterUrl,
                hrDashboardUrl: `/${tenantSlug}/hr/dashboard`,
              }
            : hrOnboardingStatus.summary.state === "complete"
              ? {
                  state: "complete" as const,
                  submittedCount: hrOnboardingStatus.summary.submittedCount,
                  submittedAtLabel: hrOnboardingStatus.summary.submittedAtLabel,
                  viewUrl: hrOnboardingStatus.summary.masterUrl,
                  hrDashboardUrl: `/${tenantSlug}/hr/dashboard`,
                }
              : { state: "none" as const, hrDashboardUrl: `/${tenantSlug}/hr/dashboard` },
        onboarding: {
          connectIntegrationDone: Boolean(
            tenant.settings?.metaPageAccessToken ||
            (tenant.settings?.whatsappAccessToken && tenant.settings?.whatsappPhoneNumberId) ||
            tenant.settings?.termiiApiKey,
          ),
          importedLeadsDone: leads.length > 0,
          createdDealDone: deals.length > 0,
          followUpSentDone: whatsappCount > 0 || activitiesCount > 0,
          firstTaskDone: deals.length > 0 || activitiesCount > 0,
        },
        integrationHealth: {
          metaLeads: Boolean(tenant.settings?.metaPageAccessToken),
          whatsapp: Boolean(tenant.settings?.whatsappAccessToken && tenant.settings?.whatsappPhoneNumberId),
          sms: Boolean(tenant.settings?.termiiApiKey),
          inboundWebhookLastAt: inboundWebhookLastAt?.createdAt.toISOString() ?? null,
        },
        kpiLeadRows: leads.map((l) => ({
          id: l.id,
          createdAt: l.createdAt.toISOString(),
          ownerId: l.assignedUserId || null,
          ownerLabel: l.assignedUserId ? userMap.get(l.assignedUserId) || "Unknown" : "Unassigned",
          source: l.source || "Unknown",
          projectInterest: l.projectInterest || "—",
          name: l.name || l.email || "Unnamed lead",
        })),
        kpiDealRows: deals.map((d) => ({
          id: d.id,
          createdAt: d.createdAt.toISOString(),
          ownerId: d.assignedUserId || null,
          ownerLabel: d.assignedUserId ? userMap.get(d.assignedUserId) || "Unknown" : "Unassigned",
          stage: d.stage,
          value: Number(d.value || 0),
          projectId: d.unit?.project?.id || null,
          projectName: d.unit?.project?.name || "No project",
        })),
        kpiProjectRows: projects.map((p) => ({
          id: p.id,
          name: p.name,
          createdAt: p.createdAt.toISOString(),
        })),
        filterOptions: {
          owners: users.map((u) => ({ id: u.user.id, label: u.user.name || u.user.email || u.user.id })),
          projects: projects.map((p) => ({ id: p.id, label: p.name })),
          leadSources: Array.from(new Set(leads.map((l) => l.source).filter(Boolean) as string[])).sort(
            (a, b) => a.localeCompare(b),
          ),
        },
        kpiInvoiceRows: invoices.map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          createdAt: inv.createdAt.toISOString(),
          issuedAt: inv.issuedAt.toISOString(),
          dueDate: inv.dueDate ? inv.dueDate.toISOString() : null,
          status: inv.status,
          amount: Number(inv.amount),
          balanceDue: Number(inv.balanceDue),
          currency: inv.currency,
          ownerId: inv.deal?.assignedUserId || null,
          ownerLabel: inv.deal?.assignedUserId
            ? userMap.get(inv.deal.assignedUserId) || "Unknown"
            : "Unassigned",
          projectId: inv.deal?.unit?.project?.id || null,
          projectName: inv.deal?.unit?.project?.name || inv.deal?.lead?.projectInterest || "No project",
        })),
        kpiPaymentRows: payments.map((p) => ({
          id: p.id,
          invoiceId: p.invoiceId,
          invoiceNumber: p.invoice?.invoiceNumber || (p.standaloneTitle ? "Direct" : "—"),
          paidAt: p.paidAt.toISOString(),
          amount: Number(p.amount),
          currency: p.currency,
          method: p.method || "—",
          reference: p.reference || "—",
          ownerId: p.invoice?.deal?.assignedUserId || null,
          ownerLabel: p.invoice?.deal?.assignedUserId
            ? userMap.get(p.invoice.deal.assignedUserId) || "Unknown"
            : "Unassigned",
          projectId: p.invoice?.deal?.unit?.project?.id || null,
          projectName:
            p.invoice?.deal?.unit?.project?.name || p.invoice?.deal?.lead?.projectInterest || "No project",
          recordedByLabel:
            p.recordedByLabel ||
            (p.recordedByUserId ? userMap.get(p.recordedByUserId) || "Unknown" : "Unknown"),
        })),
      }}
    />
  );
}
