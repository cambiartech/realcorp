import { auth } from "@/auth";
import { MembershipStatus } from "@/generated/prisma";
import { canManageHr, canViewHrModule } from "@/lib/hr-access";
import { normalizeSettingsNavSlice } from "@/lib/tenant-nav-access";
import prisma from "@/lib/db";
import { calculateNigeriaPayslip } from "@/lib/hr-payslip";
import { absoluteAppUrl } from "@/lib/app-url";
import { HR_FORM_DELIVERY_LABELS, HR_FORM_TYPE_LABELS, hrFormFillPath } from "@/lib/hr-form-types";
import { hrOfferSignPath } from "@/lib/hr-offer-path";
import { profileToDetailRow } from "@/lib/hr-profile-form";
import { buildProfileChecklist, checklistProgress } from "@/lib/hr-profile-checklist";
import { buildHrAnalytics } from "@/lib/hr-analytics";
import { aggregatePayslipYtd, type PayslipYtdSummary } from "@/lib/hr-payslip-ytd";
import { ensureEmployeeProfileForMember } from "@/lib/hr-profile-ensure";
import { loadHrOnboardingStatusForUser } from "@/lib/hr-pending-forms";
import type { PerformanceGoalRow } from "@/lib/hr-goals-by-department";
import type { YearlyArchiveEntry } from "@/components/hr/yearly-appraisal-archive";
import type { EmployeeProfile } from "@/generated/prisma";
import { brandingFromSettings } from "@/lib/tenant-branding";
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
  tab: "people" | "payslips" | "appraisals" | "documents" | "insights" | "my";
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const { tenantSlug } = await params;
  const sp = searchParamsProp ? await searchParamsProp : {};
  const session = await auth();
  if (!session?.user?.id) notFound();

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
          moduleShortLets: true,
          moduleHr: true,
          roleModuleGrants: true,
          logoUrl: true,
          primaryColor: true,
          accentColor: true,
          orgEmail: true,
          orgPhone: true,
          orgAddressLine: true,
          orgCity: true,
          orgState: true,
          orgCountry: true,
        },
      },
    },
  });
  if (!tenant) notFound();

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true, status: true },
  });

  const settingsNav = normalizeSettingsNavSlice(tenant.settings);
  if (!canViewHrModule(Boolean(session.user.isPlatformAdmin), membership, settingsNav.moduleHr)) {
    redirect(`/${tenantSlug}`);
  }

  const canManage = canManageHr(Boolean(session.user.isPlatformAdmin), membership);

  if (!canManage && tab !== "my") {
    redirect(`/${tenantSlug}/hr/dashboard`);
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

  const myViewMember = await prisma.membership.findFirst({
    where: { tenantId: tenant.id, userId: myViewUserId, status: MembershipStatus.ACTIVE },
    include: { user: { select: { name: true, email: true } } },
  });

  if (tab === "my" && myViewMember) {
    await ensureEmployeeProfileForMember(tenant.id, myViewUserId, {
      name: myViewMember.user.name,
      email: myViewMember.user.email,
    });
  }

  const myViewEmail = myViewMember?.user.email ?? session.user.email ?? null;

  const [
    members,
    profiles,
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
  ] = await Promise.all([
    prisma.membership.findMany({
      where: { tenantId: tenant.id, status: MembershipStatus.ACTIVE },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.employeeProfile.findMany({
      where: { tenantId: tenant.id },
      orderBy: { fullName: "asc" },
    }),
    prisma.hrAppraisalAction.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ cycleType: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.hrAppraisalCycle.findMany({
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
    }),
    prisma.hrPayslipRun.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 24,
      include: {
        payslips: {
          include: {
            profile: {
              select: {
                fullName: true,
                position: true,
                paygroupName: true,
                employeeNumber: true,
                bankAccount: true,
              },
            },
          },
        },
      },
    }),
    prisma.hrDocument.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { profile: { select: { fullName: true } } },
    }),
    prisma.hrPerformanceGoal.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { profile: { select: { fullName: true, department: true } } },
    }),
    prisma.employeeProfile.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId: myViewUserId } },
    }),
    prisma.hrPayslip.findMany({
      where: {
        tenantId: tenant.id,
        profile: { userId: myViewUserId },
        run: { status: "FINALIZED" },
      },
      include: { run: true, profile: true },
      orderBy: { createdAt: "desc" },
      take: 24,
    }),
    prisma.hrAppraisal.findMany({
      where: { profile: { userId: myViewUserId }, tenantId: tenant.id },
      include: { cycle: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.employeeProfile
      .findUnique({ where: { tenantId_userId: { tenantId: tenant.id, userId: myViewUserId } }, select: { id: true } })
      .then((prof) =>
        prof
          ? prisma.hrDocument.findMany({
              where: { tenantId: tenant.id, employeeProfileId: prof.id },
              orderBy: { createdAt: "desc" },
              take: 50,
            })
          : [],
      ),
    prisma.employeeProfile
      .findUnique({ where: { tenantId_userId: { tenantId: tenant.id, userId: myViewUserId } }, select: { id: true } })
      .then((prof) =>
        prof
          ? prisma.hrPerformanceGoal.findMany({
              where: { tenantId: tenant.id, employeeProfileId: prof.id },
              orderBy: { createdAt: "desc" },
              take: 20,
            })
          : [],
      ),
    loadHrOnboardingStatusForUser(tenant.id, myViewUserId, myViewEmail),
    canManage
      ? prisma.hrFormRequest.findMany({
          where: { tenantId: tenant.id },
          orderBy: { createdAt: "desc" },
          take: 80,
          include: {
            profile: { select: { fullName: true } },
          },
        })
      : Promise.resolve([]),
    prisma.hrPayslip.findMany({
      where: {
        tenantId: tenant.id,
        run: { status: "FINALIZED" },
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
    }),
    canManage
      ? prisma.hrOfferLetter.findMany({
          where: { tenantId: tenant.id },
          include: { profile: { select: { userId: true, id: true } } },
        })
      : Promise.resolve([]),
    prisma.hrOfferLetter.findFirst({
      where: {
        tenantId: tenant.id,
        status: "AWAITING_SIGNATURE",
        profile: { userId: myViewUserId },
      },
      select: { token: true },
    }),
  ]);

  const myPendingForms = myOnboardingStatus.pendingItems;
  const myOnboardingSummary = myOnboardingStatus.summary;

  const profileByUserId = new Map(profiles.map((p) => [p.userId, p]));
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
  const currentYear = new Date().getFullYear();
  const ytdByProfileId = new Map<string, PayslipYtdSummary>();
  const slipsGrouped = new Map<string, Array<{ grossPay: number; payeeTax: number; pensionDeduction: number; otherDeductions: number; netPay: number; year: number; month: number }>>();
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
    ...new Set(
      profiles
        .map((p) => p.paygroupName?.trim())
        .filter((g): g is string => Boolean(g)),
    ),
  ].sort((a, b) => a.localeCompare(b));
  const draftPayslipRunCount = payslipRuns.filter((r) => r.status === "DRAFT").length;
  const payrollReadyByPaygroup = paygroups.map((name) => ({
    name,
    count: profiles.filter(
      (p) => p.status === "ACTIVE" && p.paygroupName === name && p.grossMonthly != null && Number(p.grossMonthly) > 0,
    ).length,
  }));
  const unassignedPayrollCount = profiles.filter(
    (p) =>
      p.status === "ACTIVE" &&
      (!p.paygroupName || !p.paygroupName.trim()) &&
      p.grossMonthly != null &&
      Number(p.grossMonthly) > 0,
  ).length;
  const profileOnboarding = members.map((m) => {
    const p = profileByUserId.get(m.user.id);
    const docs = p ? documents.filter((d) => d.employeeProfileId === p.id) : [];
    const items = buildProfileChecklist(
      (p ?? { fullName: m.user.name, phoneMobile: null, position: null }) as EmployeeProfile,
      docs,
    );
    const { percent } = checklistProgress(items);
    return {
      userId: m.user.id,
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

  const departments = Array.from(
    new Set(profiles.map((p) => p.department?.trim() || "").filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  const performanceGoalRows: PerformanceGoalRow[] = goals.map((g) => ({
    id: g.id,
    employeeProfileId: g.employeeProfileId,
    employeeName: g.profile.fullName || "Unnamed",
    department: g.profile.department || "",
    title: g.title,
    description: g.description || "",
    progressPercent: g.progressPercent,
    status: g.status,
    dueDateLabel: g.dueDate ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(g.dueDate) : "—",
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
      dueDateLabel: c.dueDate ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(c.dueDate) : "—",
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
            ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(a.reviewedAt)
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

  return (
    <HrWorkspace
      tenantSlug={tenant.slug}
      companyName={tenant.name}
      tenantBrand={tenantBrand}
      currency={tenant.defaultCurrency}
      activeTab={tab}
      canManageHr={canManage}
      currentUserId={session.user.id}
      teamMembers={members.map((m) => ({
        userId: m.user.id,
        name: m.user.name || m.user.email || "User",
        email: m.user.email || "",
        role: formatEnumLabel(m.role),
        hasProfile: profileByUserId.has(m.user.id),
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
        dueDateLabel: c.dueDate ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(c.dueDate) : "—",
        appraisals: c.appraisals.map((a) => ({
          id: a.id,
          employeeName: a.profile.fullName || "Unnamed",
          position: a.profile.position || "",
          status: formatEnumLabel(a.status),
          statusValue: a.status,
          overallRating: a.overallRating,
          managerNotes: a.managerNotes || "",
          selfNotes: a.selfNotes || "",
          actionScores: (a.actionScores as Record<string, { rating?: number; completed?: boolean }> | null) ?? null,
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
        payslips: r.payslips.map((s) => {
          const earnings = (s.earningsBreakdown as { code: string; label: string; percent: number; amount: number }[]) || [];
          const deductions = (s.deductionsBreakdown as { code: string; label: string; amount: number }[]) || [];
          return {
            id: s.id,
            employeeName: s.profile.fullName || "Unnamed",
            jobRole: s.profile.position || "",
            paygroup: s.profile.paygroupName || "",
            employeeId: s.profile.employeeNumber || "",
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
            calc: {
              grossPay: Number(s.grossPay),
              earnings,
              deductions,
              payeeTax: Number(s.payeeTax),
              pensionDeduction: Number(s.pensionDeduction),
              otherDeductions: Number(s.otherDeductions),
              netPay: Number(s.netPay),
            },
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
          const calc = calculateNigeriaPayslip({
            grossMonthly: Number(s.grossPay),
            payeeTax: Number(s.payeeTax),
            otherDeductions: Number(s.otherDeductions),
            basicPercent: Number(s.profile.basicPercent),
            housingPercent: Number(s.profile.housingPercent),
            transportPercent: Number(s.profile.transportPercent),
            otherPercent: Number(s.profile.otherPercent),
          });
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
          actionScores: (a.actionScores as Record<string, { rating?: number; completed?: boolean }> | null) ?? null,
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
          dueDateLabel: g.dueDate ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(g.dueDate) : "—",
        })),
        pendingForms: (() => {
          const mapped = myPendingForms.map((f) => {
            const expiresLabel = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(f.expiresAt);
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
        pendingOfferSignUrl: myPendingOffer?.token ? absoluteAppUrl(hrOfferSignPath(myPendingOffer.token)) : null,
        appraisalActions: appraisalActions
          .filter((a) => a.isActive)
          .map((a) => ({
            id: a.id,
            title: a.title,
            description: a.description || "",
            cycleType: a.cycleType,
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
          ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(r.submittedAt)
          : "—",
        hasFileUpload: Boolean(r.submittedFileUrl),
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
