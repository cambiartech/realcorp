import { MembershipStatus } from "@/generated/prisma";
import { canManageHr, canViewHrModule } from "@/lib/hr-access";
import { normalizeSettingsNavSlice } from "@/lib/tenant-nav-access";
import prisma from "@/lib/db";
import { payslipCalculationFromStored } from "@/lib/hr-payslip";
import { absoluteAppUrl } from "@/lib/app-url";
import { HR_FORM_DELIVERY_LABELS, HR_FORM_TYPE_LABELS } from "@/lib/hr-form-types";
import { hrOfferSignPath } from "@/lib/hr-offer-path";
import { profileToDetailRow } from "@/lib/hr-profile-form";
import { buildProfileChecklist, checklistProgress } from "@/lib/hr-profile-checklist";
import { buildHrAnalytics } from "@/lib/hr-analytics";
import {
  buildStaffMonthlyPerformance,
  currentMonthPerformancePeriod,
  monthPerformancePeriod,
  type StaffMonthlyPerformancePeriod,
} from "@/lib/staff-monthly-performance";
import { aggregatePayslipYtd, type PayslipYtdSummary } from "@/lib/hr-payslip-ytd";
import { ensureEmployeeProfileForMember } from "@/lib/hr-profile-ensure";
import { ensureDefaultAppraisalCriteria } from "@/app/[tenantSlug]/hr/actions";
import { loadHrOnboardingStatusForUser } from "@/lib/hr-pending-forms";
import type { PerformanceGoalRow } from "@/lib/hr-goals-by-department";
import type { YearlyArchiveEntry } from "@/components/hr/yearly-appraisal-archive";
import type { EmployeeProfile } from "@/generated/prisma";
import { brandingFromSettings } from "@/lib/tenant-branding";
import { mergeOrgDepartments } from "@/lib/org-departments";
import { loadTenantRequest } from "@/lib/tenant-request";
import { redirect } from "next/navigation";
import { formatEnumLabel } from "@/lib/ui-format";
import { notFound } from "next/navigation";
import { HrWorkspace } from "./hr-workspace";

export const dynamic = "force-dynamic";

function bankField(bank: unknown, key: string): string {
  if (!bank || typeof bank !== "object") return "";
  const v = (bank as Record<string, unknown>)[key];
  return typeof v === "string" ? v : "";
}

export default async function HrQueuePage({
  params,
  tab,
  searchParams: searchParamsProp,
}: {
  params: Promise<{ tenantSlug: string }>;
  tab: "people" | "payslips" | "remittances" | "appraisals" | "documents" | "insights" | "my";
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const { tenantSlug } = await params;
  const sp = searchParamsProp ? await searchParamsProp : {};
  const { session, tenant, membership } = await loadTenantRequest(tenantSlug);
  if (!session?.user?.id) notFound();
  if (!tenant) notFound();

  const settingsNav = normalizeSettingsNavSlice(tenant.settings);
  if (!canViewHrModule(Boolean(session.user.isPlatformAdmin), membership, settingsNav.moduleHr)) {
    redirect(`/${tenantSlug}`);
  }

  const canManage = canManageHr(Boolean(session.user.isPlatformAdmin), membership);

  if (!canManage && tab !== "my") {
    redirect(`/${tenantSlug}/hr/dashboard`);
  }

  if (tab === "appraisals") {
    await ensureDefaultAppraisalCriteria(tenant.id);
  }

  const previewEmployeeUserId =
    canManage && tab === "my" && sp.employeeUserId?.trim() ? sp.employeeUserId.trim() : null;
  const myViewUserId = previewEmployeeUserId ?? session.user.id;

  if (previewEmployeeUserId) {
    const previewMember = await prisma.membership.findFirst({
      where: { tenantId: tenant.id, userId: previewEmployeeUserId, status: MembershipStatus.ACTIVE },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!previewMember) {
      redirect(`/${tenantSlug}/hr/people`);
    }
  }

  const myViewMember =
    tab === "my"
      ? await prisma.membership.findFirst({
          where: { tenantId: tenant.id, userId: myViewUserId, status: MembershipStatus.ACTIVE },
          include: { user: { select: { name: true, email: true } } },
        })
      : null;

  if (tab === "my" && myViewMember) {
    await ensureEmployeeProfileForMember(tenant.id, myViewUserId, {
      name: myViewMember.user.name,
      email: myViewMember.user.email,
    });
  }

  const myViewEmail = myViewMember?.user.email ?? session.user.email ?? null;

  const loadDirectory = tab === "people" || tab === "documents" || tab === "insights" || tab === "payslips" || tab === "remittances" || tab === "appraisals";
  const loadPayslipRuns = tab === "payslips" || tab === "remittances";
  const loadAppraisals = tab === "appraisals" || tab === "insights";
  const loadDocumentsFull = tab === "documents";
  const loadChecklistDocs = tab === "people";
  const loadMy = tab === "my";
  const loadPeopleExtras = tab === "people";
  const loadYtd = tab === "people" || tab === "payslips" || tab === "my";
  const loadScores = tab === "appraisals";
  const loadGoals = tab === "appraisals" || tab === "insights" || tab === "my";

  const currentYear = new Date().getFullYear();
  const scoreDataSince = new Date();
  scoreDataSince.setMonth(scoreDataSince.getMonth() - 11);
  scoreDataSince.setDate(1);
  scoreDataSince.setHours(0, 0, 0, 0);

  const emptyOnboarding = {
    pendingItems: [] as Awaited<ReturnType<typeof loadHrOnboardingStatusForUser>>["pendingItems"],
    summary: { state: "none" as const },
    masterOnboardingUrl: null as string | null,
  };

  const [
    members,
    profiles,
    payTemplates,
    appraisalActions,
    appraisalCycles,
    payslipRuns,
    documents,
    goals,
    myProfile,
    myPayslips,
    myAppraisals,
    myDocuments,
    myGoals,
    myOnboardingStatus,
    formRequests,
    ytdPayslips,
    offerLetters,
    myPendingOffer,
    workTasks,
    scoreLeads,
    scoreDeals,
    scoreActivities,
  ] = await Promise.all([
    loadDirectory
      ? prisma.membership.findMany({
          where: { tenantId: tenant.id, status: MembershipStatus.ACTIVE },
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    loadDirectory || loadMy
      ? prisma.employeeProfile.findMany({
          where: { tenantId: tenant.id },
          orderBy: { fullName: "asc" },
        })
      : Promise.resolve([]),
    loadPeopleExtras || loadPayslipRuns
      ? prisma.hrPayTemplate.findMany({
          where: { tenantId: tenant.id },
          orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        })
      : Promise.resolve([]),
    loadAppraisals || loadMy
      ? prisma.hrAppraisalAction.findMany({
          where: { tenantId: tenant.id },
          orderBy: [{ cycleType: "asc" }, { sortOrder: "asc" }],
        })
      : Promise.resolve([]),
    loadAppraisals
      ? prisma.hrAppraisalCycle.findMany({
          where: { tenantId: tenant.id },
          orderBy: { createdAt: "desc" },
          take: 48,
          include: {
            appraisals: {
              include: {
                profile: {
                  select: { fullName: true, position: true, userId: true, department: true },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    loadPayslipRuns
      ? prisma.hrPayslipRun.findMany({
          where: { tenantId: tenant.id },
          orderBy: [{ year: "desc" }, { month: "desc" }],
          take: 24,
          include: {
            adjustments: { orderBy: { createdAt: "asc" } },
            payslips: {
              include: {
                profile: {
                  select: {
                    fullName: true,
                    position: true,
                    paygroupName: true,
                    employeeNumber: true,
                    department: true,
                    taxId: true,
                    rsaPin: true,
                    pensionAdministrator: true,
                    nhfMembershipNumber: true,
                    bankAccount: true,
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    loadDocumentsFull
      ? prisma.hrDocument.findMany({
          where: { tenantId: tenant.id, deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 200,
          include: { profile: { select: { fullName: true } } },
        })
      : loadChecklistDocs
        ? prisma.hrDocument.findMany({
            where: { tenantId: tenant.id, deletedAt: null },
            select: {
              id: true,
              employeeProfileId: true,
              category: true,
              title: true,
              fileUrl: true,
              fileName: true,
              createdAt: true,
              profile: { select: { fullName: true } },
            },
          })
        : Promise.resolve([]),
    loadGoals
      ? prisma.hrPerformanceGoal.findMany({
          where: { tenantId: tenant.id },
          orderBy: { createdAt: "desc" },
          take: 100,
          include: { profile: { select: { fullName: true, department: true } } },
        })
      : Promise.resolve([]),
    loadMy
      ? prisma.employeeProfile.findUnique({
          where: { tenantId_userId: { tenantId: tenant.id, userId: myViewUserId } },
        })
      : Promise.resolve(null),
    loadMy
      ? prisma.hrPayslip.findMany({
          where: {
            tenantId: tenant.id,
            profile: { userId: myViewUserId },
            run: { status: "FINALIZED" },
          },
          include: { run: true, profile: true },
          orderBy: { createdAt: "desc" },
          take: 24,
        })
      : Promise.resolve([]),
    loadMy
      ? prisma.hrAppraisal.findMany({
          where: { profile: { userId: myViewUserId }, tenantId: tenant.id },
          include: { cycle: true },
          orderBy: { updatedAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
    loadMy
      ? prisma.employeeProfile
          .findUnique({
            where: { tenantId_userId: { tenantId: tenant.id, userId: myViewUserId } },
            select: { id: true },
          })
          .then((prof) =>
            prof
              ? prisma.hrDocument.findMany({
                  where: { tenantId: tenant.id, employeeProfileId: prof.id, deletedAt: null },
                  orderBy: { createdAt: "desc" },
                  take: 50,
                })
              : [],
          )
      : Promise.resolve([]),
    loadMy
      ? prisma.employeeProfile
          .findUnique({
            where: { tenantId_userId: { tenantId: tenant.id, userId: myViewUserId } },
            select: { id: true },
          })
          .then((prof) =>
            prof
              ? prisma.hrPerformanceGoal.findMany({
                  where: { tenantId: tenant.id, employeeProfileId: prof.id },
                  orderBy: { createdAt: "desc" },
                  take: 20,
                })
              : [],
          )
      : Promise.resolve([]),
    loadMy ? loadHrOnboardingStatusForUser(tenant.id, myViewUserId, myViewEmail) : Promise.resolve(emptyOnboarding),
    loadPeopleExtras && canManage
      ? prisma.hrFormRequest.findMany({
          where: { tenantId: tenant.id },
          orderBy: { createdAt: "desc" },
          take: 80,
          include: {
            profile: { select: { fullName: true } },
          },
        })
      : Promise.resolve([]),
    loadYtd
      ? prisma.hrPayslip.findMany({
          where: {
            tenantId: tenant.id,
            run: { status: "FINALIZED", year: currentYear },
          },
          select: {
            employeeProfileId: true,
            grossPay: true,
            payeeTax: true,
            pensionDeduction: true,
            otherDeductions: true,
            netPay: true,
            run: { select: { year: true, month: true } },
          },
        })
      : Promise.resolve([]),
    loadPeopleExtras && canManage
      ? prisma.hrOfferLetter.findMany({
          where: { tenantId: tenant.id },
          include: { profile: { select: { userId: true, id: true } } },
        })
      : Promise.resolve([]),
    loadMy
      ? prisma.hrOfferLetter.findFirst({
          where: {
            tenantId: tenant.id,
            status: "AWAITING_SIGNATURE",
            profile: { userId: myViewUserId },
          },
          select: { token: true },
        })
      : Promise.resolve(null),
    loadScores
      ? prisma.workTask.findMany({
          where: {
            tenantId: tenant.id,
            OR: [
              { createdAt: { gte: scoreDataSince } },
              { completedAt: { gte: scoreDataSince } },
              { dueDate: { gte: scoreDataSince } },
            ],
          },
          select: {
            assigneeUserId: true,
            status: true,
            dueDate: true,
            completedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        })
      : Promise.resolve([]),
    loadScores
      ? prisma.lead.findMany({
          where: { tenantId: tenant.id, createdAt: { gte: scoreDataSince } },
          select: { assignedUserId: true, createdAt: true },
        })
      : Promise.resolve([]),
    loadScores
      ? prisma.deal.findMany({
          where: { tenantId: tenant.id, updatedAt: { gte: scoreDataSince } },
          select: { assignedUserId: true, stage: true, value: true, updatedAt: true },
        })
      : Promise.resolve([]),
    loadScores
      ? prisma.activity.findMany({
          where: {
            tenantId: tenant.id,
            OR: [{ createdAt: { gte: scoreDataSince } }, { completedAt: { gte: scoreDataSince } }],
          },
          select: { assignedUserId: true, completedAt: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);


  const myPendingForms = myOnboardingStatus.pendingItems;
  const myOnboardingSummary = myOnboardingStatus.summary;

  const profileByUserId = new Map(profiles.map((p) => [p.userId, p]));
  const memberUserIds = new Set(members.map((m) => m.user.id));
  const hrOnlyProfiles = profiles.filter((profile) => !memberUserIds.has(profile.userId));
  const hrOnlyUsers = hrOnlyProfiles.length
    ? await prisma.user.findMany({
        where: { id: { in: hrOnlyProfiles.map((profile) => profile.userId) } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const hrOnlyUserById = new Map(hrOnlyUsers.map((user) => [user.id, user]));
  const directoryPeople = [
    ...members.map((membership) => ({
      userId: membership.user.id,
      name: membership.user.name || membership.user.email || "User",
      email: membership.user.email || "",
      role: formatEnumLabel(membership.role),
    })),
    ...hrOnlyProfiles.map((profile) => {
      const user = hrOnlyUserById.get(profile.userId);
      return {
        userId: profile.userId,
        name: profile.fullName || user?.name || user?.email || "Employee",
        email: profile.workEmail || user?.email || "",
        role: "HR/payroll only · No login",
      };
    }),
  ];
  const offerByUserId = Object.fromEntries(
    offerLetters.map((o) => [
      o.profile.userId,
      {
        profileId: o.profile.id,
        bodyHtml: o.bodyHtml,
        status: o.status as "DRAFT" | "AWAITING_SIGNATURE" | "SIGNED",
        signUrl: o.token ? absoluteAppUrl(hrOfferSignPath(o.token)) : undefined,
      },
    ]),
  );
  const ytdByProfileId = new Map<string, PayslipYtdSummary>();
  const slipsGrouped = new Map<
    string,
    Array<{
      grossPay: number;
      payeeTax: number;
      pensionDeduction: number;
      otherDeductions: number;
      netPay: number;
      year: number;
      month: number;
    }>
  >();
  for (const s of ytdPayslips) {
    const list = slipsGrouped.get(s.employeeProfileId) ?? [];
    list.push({
      grossPay: Number(s.grossPay),
      payeeTax: Number(s.payeeTax),
      pensionDeduction: Number(s.pensionDeduction),
      otherDeductions: Number(s.otherDeductions),
      netPay: Number(s.netPay),
      year: s.run.year,
      month: s.run.month,
    });
    slipsGrouped.set(s.employeeProfileId, list);
  }
  for (const p of profiles) {
    ytdByProfileId.set(p.id, aggregatePayslipYtd(slipsGrouped.get(p.id) ?? [], currentYear));
  }
  const paygroups = [
    ...new Set(profiles.map((p) => p.paygroupName?.trim()).filter((g): g is string => Boolean(g))),
  ].sort((a, b) => a.localeCompare(b));
  const draftPayslipRunCount = payslipRuns.filter((r) => r.status === "DRAFT").length;
  const payrollReadyByPaygroup = paygroups.map((name) => ({
    name,
    count: profiles.filter(
      (p) =>
        p.status === "ACTIVE" &&
        p.paygroupName === name &&
        p.grossMonthly != null &&
        Number(p.grossMonthly) > 0,
    ).length,
  }));
  const unassignedPayrollCount = profiles.filter(
    (p) =>
      p.status === "ACTIVE" &&
      (!p.paygroupName || !p.paygroupName.trim()) &&
      p.grossMonthly != null &&
      Number(p.grossMonthly) > 0,
  ).length;
  const profileOnboarding = directoryPeople.map((person) => {
    const p = profileByUserId.get(person.userId);
    const docs = p ? documents.filter((d) => d.employeeProfileId === p.id) : [];
    const items = buildProfileChecklist(
      (p ?? { fullName: person.name, phoneMobile: null, position: null }) as EmployeeProfile,
      docs as Parameters<typeof buildProfileChecklist>[1],
    );
    const { percent } = checklistProgress(items);
    return {
      userId: person.userId,
      profileId: p?.id ?? null,
      items,
      percent,
    };
  });
  const tenantBrand = brandingFromSettings(tenant.name, tenant.settings);
  const previewEmployee = previewEmployeeUserId
    ? members.find((m) => m.user.id === previewEmployeeUserId)
    : null;
  const myDashboardPreview =
    previewEmployeeUserId && previewEmployee
      ? {
          userId: previewEmployeeUserId,
          name: previewEmployee.user.name || previewEmployee.user.email || "Employee",
          email: previewEmployee.user.email || "",
        }
      : null;
  const payrollReadyCount = profiles.filter(
    (p) => p.status === "ACTIVE" && p.grossMonthly != null && Number(p.grossMonthly) > 0,
  ).length;
  const missingGrossCount = profiles.filter(
    (p) => p.status === "ACTIVE" && (p.grossMonthly == null || Number(p.grossMonthly) <= 0),
  ).length;

  const departments = mergeOrgDepartments([
    ...((tenant.settings?.orgDepartments as string[] | null | undefined) ?? []),
    ...profiles.map((p) => p.department?.trim() || ""),
  ]).sort((a, b) => a.localeCompare(b));

  const performanceGoalRows: PerformanceGoalRow[] = goals.map((g) => ({
    id: g.id,
    employeeProfileId: g.employeeProfileId,
    employeeName: g.profile.fullName || "Unnamed",
    department: g.profile.department || "",
    title: g.title,
    description: g.description || "",
    progressPercent: g.progressPercent,
    status: g.status,
    dueDateLabel: g.dueDate
      ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(g.dueDate)
      : "—",
  }));

  const profileOptions = profiles
    .filter((p) => p.status === "ACTIVE" || p.status === "DRAFT")
    .map((p) => {
      const member = members.find((m) => m.user.id === p.userId);
      return {
        id: p.id,
        label: p.fullName || member?.user.name || member?.user.email || "Employee",
        department: p.department || "",
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  const yearlyArchive: YearlyArchiveEntry[] = appraisalCycles
    .filter((c) => c.cycleType === "YEARLY" && c.status === "CLOSED")
    .map((c) => ({
      cycleId: c.id,
      periodLabel: c.periodLabel,
      status: formatEnumLabel(c.status),
      dueDateLabel: c.dueDate
        ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(c.dueDate)
        : "—",
      closedLabel: new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(c.updatedAt),
      appraisals: c.appraisals
        .filter((a) => a.status === "REVIEWED")
        .map((a) => ({
          id: a.id,
          employeeName: a.profile.fullName || "Unnamed",
          position: a.profile.position || "",
          department: a.profile.department || "",
          overallRating: a.overallRating,
          managerNotes: a.managerNotes || "",
          selfNotes: a.selfNotes || "",
          reviewedAtLabel: a.reviewedAt
            ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(
                a.reviewedAt,
              )
            : "—",
          reviewerLabel: a.reviewerLabel || "—",
        })),
    }))
    .filter((e) => e.appraisals.length > 0);

  const flatAppraisals = appraisalCycles.flatMap((c) =>
    c.appraisals.map((a) => ({
      status: a.status,
      cycleStatus: c.status,
      cycleDueDate: c.dueDate,
    })),
  );

  const hrAnalytics = buildHrAnalytics({
    teamSize: members.length,
    openAppraisalCycleCount: appraisalCycles.filter((c) => c.status === "OPEN").length,
    profiles: profiles.map((p) => ({
      status: p.status,
      dateOfJoining: p.dateOfJoining,
      updatedAt: p.updatedAt,
    })),
    appraisals: flatAppraisals,
    goals: goals.map((g) => ({ status: g.status, progressPercent: g.progressPercent })),
    payrollReadyCount,
    missingGrossCount,
  });

  const monthlyAppraisalActionIds = appraisalActions
    .filter((a) => a.cycleType === "MONTHLY" && a.isActive)
    .map((a) => a.id);

  const staffPerformancePeriods: StaffMonthlyPerformancePeriod[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return monthPerformancePeriod(d.getFullYear(), d.getMonth() + 1);
  });

  const staffPerformanceInput = {
    profiles: profiles.map((p) => ({
      id: p.id,
      userId: p.userId,
      fullName: p.fullName || "Unnamed",
      department: p.department,
      position: p.position,
      status: p.status,
    })),
    tasks: workTasks,
    appraisals: appraisalCycles.flatMap((c) =>
      c.appraisals.map((a) => ({
        employeeProfileId: a.employeeProfileId,
        status: a.status,
        overallRating: a.overallRating,
        actionScores: a.actionScores,
        cycleType: c.cycleType,
        periodLabel: c.periodLabel,
      })),
    ),
    appraisalActionIds: monthlyAppraisalActionIds,
    leads: scoreLeads,
    deals: scoreDeals.map((d) => ({
      assignedUserId: d.assignedUserId,
      stage: d.stage,
      value: d.value != null ? Number(d.value) : 0,
      updatedAt: d.updatedAt,
    })),
    activities: scoreActivities,
    goals: goals.map((g) => ({
      employeeProfileId: g.employeeProfileId,
      progressPercent: g.progressPercent,
      status: g.status,
    })),
  };

  const staffMonthlyScoresDefault = buildStaffMonthlyPerformance({
    period: currentMonthPerformancePeriod(),
    ...staffPerformanceInput,
  });

  return (
    <HrWorkspace
      tenantSlug={tenant.slug}
      companyName={tenant.name}
      tenantBrand={tenantBrand}
      currency={tenant.defaultCurrency}
      activeTab={tab}
      canManageHr={canManage}
      aiEnabled={Boolean(tenant.settings?.moduleAi)}
      currentUserId={session.user.id}
      teamMembers={directoryPeople.map((person) => ({
        ...person,
        hasProfile: profileByUserId.has(person.userId),
      }))}
      profiles={profiles.map((p) => {
        const bank = p.bankAccount;
        return {
          id: p.id,
          userId: p.userId,
          employeeNumber: p.employeeNumber || "",
          fullName: p.fullName || "Unnamed",
          position: p.position || "—",
          department: p.department || "—",
          status: formatEnumLabel(p.status),
          statusValue: p.status,
          grossMonthly: p.grossMonthly ? Number(p.grossMonthly) : null,
          paygroupName: p.paygroupName || "",
          bankName: bankField(bank, "bankName"),
          accountNumber: bankField(bank, "accountNumber"),
          dateOfJoiningLabel: p.dateOfJoining
            ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(p.dateOfJoining)
            : "—",
        };
      })}
      payTemplates={payTemplates.map((template) => ({
        id: template.id,
        name: template.name,
        countryCode: template.countryCode,
        basicPercent: Number(template.basicPercent),
        housingPercent: Number(template.housingPercent),
        transportPercent: Number(template.transportPercent),
        otherPercent: Number(template.otherPercent),
        pensionEnabled: template.pensionEnabled,
        employeePensionRate: Number(template.employeePensionRate),
        employerPensionRate: Number(template.employerPensionRate),
        isDefault: template.isDefault,
      }))}
      appraisalActions={appraisalActions.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description || "",
        cycleType: a.cycleType,
        cycleTypeLabel: a.cycleType === "MONTHLY" ? "Monthly" : "Yearly",
        isActive: a.isActive,
        sortOrder: a.sortOrder,
      }))}
      appraisalCycles={appraisalCycles.map((c) => ({
        id: c.id,
        cycleType: c.cycleType,
        cycleTypeLabel: c.cycleType === "MONTHLY" ? "Monthly" : "Yearly",
        periodLabel: c.periodLabel,
        status: c.status,
        statusValue: c.status,
        statusLabel: formatEnumLabel(c.status),
        dueDateLabel: c.dueDate
          ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(c.dueDate)
          : "—",
        appraisals: c.appraisals.map((a) => ({
          id: a.id,
          employeeName: a.profile.fullName || "Unnamed",
          position: a.profile.position || "",
          status: formatEnumLabel(a.status),
          statusValue: a.status,
          overallRating: a.overallRating,
          managerNotes: a.managerNotes || "",
          selfNotes: a.selfNotes || "",
          actionScores:
            (a.actionScores as Record<string, { rating?: number; completed?: boolean }> | null) ?? null,
        })),
      }))}
      payrollReadyCount={payrollReadyCount}
      missingGrossCount={missingGrossCount}
      paygroups={paygroups}
      payrollReadyByPaygroup={payrollReadyByPaygroup}
      unassignedPayrollCount={unassignedPayrollCount}
      draftPayslipRunCount={draftPayslipRunCount}
      ytdByUserId={profiles.map((p) => ({
        userId: p.userId,
        ytd: ytdByProfileId.get(p.id) ?? {
          year: currentYear,
          monthsPaid: 0,
          grossYtd: 0,
          payeeYtd: 0,
          pensionYtd: 0,
          otherDeductionsYtd: 0,
          netYtd: 0,
        },
      }))}
      payslipRuns={payslipRuns.map((r) => ({
        id: r.id,
        label: r.label,
        year: r.year,
        month: r.month,
        status: formatEnumLabel(r.status),
        statusValue: r.status,
        payslipCount: r.payslips.length,
        adjustments: r.adjustments.map((adjustment) => ({
          id: adjustment.id,
          employeeProfileId: adjustment.employeeProfileId,
          type: adjustment.type,
          label: adjustment.label,
          amount: Number(adjustment.amount),
          taxable: adjustment.taxable,
          pensionable: adjustment.pensionable,
          preTax: adjustment.preTax,
        })),
        payslips: r.payslips.map((s) => {
          return {
            id: s.id,
            employeeProfileId: s.employeeProfileId,
            employeeName: s.profile.fullName || "Unnamed",
            jobRole: s.profile.position || "",
            paygroup: s.profile.paygroupName || "",
            employeeId: s.profile.employeeNumber || "",
            department: s.profile.department || "",
            taxId: s.profile.taxId || "",
            rsaPin: s.profile.rsaPin || "",
            pensionAdministrator: s.profile.pensionAdministrator || "",
            nhfMembershipNumber: s.profile.nhfMembershipNumber || "",
            accountNumber: bankField(s.profile.bankAccount, "accountNumber"),
            bankName: bankField(s.profile.bankAccount, "bankName"),
            grossPay: Number(s.grossPay),
            netPay: Number(s.netPay),
            paymentStatus: s.paymentStatus === "PAID" ? "Paid" : "Pending payment",
            paymentStatusValue: s.paymentStatus,
            paidAtLabel: s.paidAt
              ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(s.paidAt)
              : "—",
            paymentReference: s.paymentReference || "",
            calc: payslipCalculationFromStored(s),
          };
        }),
      }))}
      documents={documents.map((d) => ({
        id: d.id,
        employeeProfileId: d.employeeProfileId,
        employeeName: d.profile.fullName || "Unnamed",
        category: formatEnumLabel(d.category),
        categoryValue: d.category,
        title: d.title,
        fileUrl: d.fileUrl,
        fileName: d.fileName || d.title,
        uploadedAtLabel: new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(d.createdAt),
      }))}
      performanceGoals={performanceGoalRows}
      profileOptions={profileOptions}
      departments={departments}
      yearlyArchive={yearlyArchive}
      staffPerformancePeriods={staffPerformancePeriods.map((p) => ({
        year: p.year,
        month: p.month,
        label: p.label,
        start: p.start.toISOString(),
        end: p.end.toISOString(),
      }))}
      staffPerformanceInput={staffPerformanceInput}
      staffMonthlyScoresDefault={staffMonthlyScoresDefault}
      hrAnalytics={hrAnalytics}
      myYtd={
        myProfile
          ? (ytdByProfileId.get(myProfile.id) ?? {
              year: currentYear,
              monthsPaid: 0,
              grossYtd: 0,
              payeeYtd: 0,
              pensionYtd: 0,
              otherDeductionsYtd: 0,
              netYtd: 0,
            })
          : null
      }
      myView={{
        profile: myProfile ? profileToDetailRow(myProfile) : null,
        payslips: myPayslips.map((s) => {
          const calc = payslipCalculationFromStored(s);
          return {
            id: s.id,
            periodLabel: s.run.label,
            calc,
            employeeName: s.profile.fullName || session.user.name || "You",
            jobRole: s.profile.position || "",
            paygroup: s.profile.paygroupName || "",
            employeeId: s.profile.employeeNumber || "",
            accountNumber: bankField(s.profile.bankAccount, "accountNumber"),
            bankName: bankField(s.profile.bankAccount, "bankName"),
            paymentStatus: s.paymentStatus === "PAID" ? "Paid" : "Pending payment",
            paymentStatusValue: s.paymentStatus,
            paidAtLabel: s.paidAt
              ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(s.paidAt)
              : "—",
          };
        }),
        appraisals: myAppraisals.map((a) => ({
          id: a.id,
          periodLabel: a.cycle.periodLabel,
          cycleType: a.cycle.cycleType,
          cycleTypeLabel: a.cycle.cycleType === "MONTHLY" ? "Monthly" : "Yearly",
          cycleStatus: a.cycle.status,
          dueDateLabel: a.cycle.dueDate
            ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(a.cycle.dueDate)
            : "—",
          status: formatEnumLabel(a.status),
          statusValue: a.status,
          selfNotes: a.selfNotes || "",
          managerNotes: a.managerNotes || "",
          overallRating: a.overallRating,
          actionScores:
            (a.actionScores as Record<string, { rating?: number; completed?: boolean }> | null) ?? null,
        })),
        documents: myDocuments.map((d) => ({
          id: d.id,
          category: formatEnumLabel(d.category),
          title: d.title,
          fileUrl: d.fileUrl,
          uploadedAtLabel: new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(d.createdAt),
        })),
        goals: myGoals.map((g) => ({
          id: g.id,
          title: g.title,
          progressPercent: g.progressPercent,
          status: g.status,
          dueDateLabel: g.dueDate
            ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(g.dueDate)
            : "—",
        })),
        pendingForms: (() => {
          const mapped = myPendingForms.map((f) => {
            const expiresLabel = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(
              f.expiresAt,
            );
            if (f.kind === "bundle") {
              return {
                id: f.bundleToken,
                formTypeLabel: f.label,
                fillUrl: f.fillUrl,
                expiresLabel,
                progressLabel: `${f.total} sections`,
                isMasterBundle: true as const,
              };
            }
            return {
              id: f.id,
              formTypeLabel: f.formTypeLabel,
              fillUrl: f.fillUrl,
              expiresLabel,
              isMasterBundle: false as const,
            };
          });
          const master = mapped.find((m) => m.isMasterBundle);
          return master ? [master] : mapped;
        })(),
        masterOnboardingUrl: myOnboardingStatus.masterOnboardingUrl,
        onboardingSummary:
          myOnboardingSummary.state === "complete"
            ? {
                state: "complete" as const,
                submittedCount: myOnboardingSummary.submittedCount,
                totalCount: myOnboardingSummary.totalCount,
                submittedAtLabel: myOnboardingSummary.submittedAtLabel,
                viewUrl: myOnboardingSummary.masterUrl,
              }
            : myOnboardingSummary.state === "pending"
              ? {
                  state: "pending" as const,
                  pendingCount: myOnboardingSummary.pendingCount,
                  sectionLabels: myOnboardingSummary.sectionLabels,
                  dueLabel: myOnboardingSummary.dueLabel,
                  masterUrl: myOnboardingSummary.masterUrl,
                }
              : { state: "none" as const },
        pendingOfferSignUrl: myPendingOffer?.token
          ? absoluteAppUrl(hrOfferSignPath(myPendingOffer.token))
          : null,
        appraisalActions: appraisalActions
          .filter((a) => a.isActive)
          .map((a) => ({
            id: a.id,
            title: a.title,
            description: a.description || "",
            cycleType: a.cycleType,
            sortOrder: a.sortOrder,
          })),
      }}
      formRequests={formRequests.map((r) => ({
        id: r.id,
        employeeProfileId: r.employeeProfileId,
        employeeName: r.profile?.fullName || r.recipientName || "Unnamed",
        formType: r.formType,
        formTypeLabel: HR_FORM_TYPE_LABELS[r.formType],
        deliveryMode: r.deliveryMode,
        deliveryLabel: HR_FORM_DELIVERY_LABELS[r.deliveryMode],
        status: formatEnumLabel(r.status),
        statusValue: r.status,
        expiresLabel: new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(r.expiresAt),
        submittedAtLabel: r.submittedAt
          ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(
              r.submittedAt,
            )
          : "—",
        hasFileUpload: Boolean(r.submittedFileUrl),
        submittedFileUrl: r.submittedFileUrl,
        submittedPayload:
          r.submittedPayload && typeof r.submittedPayload === "object"
            ? (r.submittedPayload as Record<string, unknown>)
            : null,
        reviewNote: r.hrNote,
      }))}
      profileDetails={profiles.map((p) => profileToDetailRow(p))}
      profileOnboarding={profileOnboarding}
      peopleOnboardUserId={tab === "people" ? sp.onboard?.trim() || undefined : undefined}
      offerByUserId={offerByUserId}
      documentsForUserId={tab === "documents" ? sp.forUser?.trim() || undefined : undefined}
      documentsReturnOnboardUserId={tab === "documents" ? sp.returnOnboard?.trim() || undefined : undefined}
      myDashboardPreview={myDashboardPreview}
    />
  );
}
