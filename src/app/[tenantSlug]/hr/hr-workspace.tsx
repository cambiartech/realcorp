"use client";

import Link from "next/link";
import { useMemo } from "react";
import { HrAppraisalsWorkspace } from "@/components/hr/hr-appraisals-workspace";
import { HrDocumentsWorkspace } from "@/components/hr/hr-documents-workspace";
import { HrMyDashboard } from "@/components/hr/hr-my-dashboard";
import { HrPayslipsWorkspace } from "@/components/hr/hr-payslips-workspace";
import { HrRemittancesWorkspace } from "@/components/hr/hr-remittances-workspace";
import { HrInsightsWorkspace } from "@/components/hr/hr-insights-workspace";
import { HrPeopleWorkspace } from "@/components/hr/hr-people-workspace";
import type { HrAnalyticsSnapshot } from "@/lib/hr-analytics";
import type { PerformanceGoalRow } from "@/lib/hr-goals-by-department";
import type { YearlyArchiveEntry } from "@/components/hr/yearly-appraisal-archive";
import type { StaffMonthlyScoreEntry } from "@/lib/staff-monthly-performance";
import type { ProfileDetailRow } from "@/lib/hr-profile-form";
import type { PayslipCalculation } from "@/lib/hr-payslip";
import type { TenantBranding } from "@/lib/tenant-branding";

type HrTab = "people" | "payslips" | "remittances" | "appraisals" | "documents" | "insights" | "my";

export function HrWorkspace(props: {
  tenantSlug: string;
  companyName: string;
  tenantBrand: TenantBranding;
  currency: string;
  activeTab: HrTab;
  initialMyTab?: string;
  canManageHr: boolean;
  aiEnabled: boolean;
  currentUserId: string;
  teamMembers: Array<{ userId: string; name: string; email: string; role: string; hasProfile: boolean }>;
  profiles: Array<{
    id: string;
    userId: string;
    employeeNumber: string;
    fullName: string;
    position: string;
    department: string;
    status: string;
    statusValue: string;
    grossMonthly: number | null;
    paygroupName: string;
    bankName: string;
    accountNumber: string;
    dateOfJoiningLabel: string;
  }>;
  payTemplates: Array<{
    id: string;
    name: string;
    countryCode: string;
    basicPercent: number;
    housingPercent: number;
    transportPercent: number;
    otherPercent: number;
    pensionEnabled: boolean;
    employeePensionRate: number;
    employerPensionRate: number;
    isDefault: boolean;
  }>;
  profileDetails: import("@/lib/hr-profile-form").ProfileDetailRow[];
  profileOnboarding: Array<{
    userId: string;
    profileId: string | null;
    items: import("@/lib/hr-profile-checklist").ProfileChecklistItem[];
    percent: number;
  }>;
  appraisalActions: Array<{
    id: string;
    title: string;
    description: string;
    cycleType: string;
    cycleTypeLabel: string;
    isActive: boolean;
    sortOrder: number;
  }>;
  appraisalCycles: Array<{
    id: string;
    cycleType: string;
    cycleTypeLabel: string;
    periodLabel: string;
    status: string;
    statusValue: string;
    statusLabel: string;
    dueDateLabel: string;
    appraisals: Array<{
      id: string;
      employeeName: string;
      position: string;
      status: string;
      statusValue: string;
      overallRating: number | null;
      managerNotes: string;
      selfNotes: string;
      actionScores: Record<string, { rating?: number; completed?: boolean }> | null;
    }>;
  }>;
  payrollReadyCount: number;
  missingGrossCount: number;
  paygroups: string[];
  payrollReadyByPaygroup: Array<{ name: string; count: number }>;
  unassignedPayrollCount: number;
  draftPayslipRunCount: number;
  ytdByUserId: Array<{ userId: string; ytd: import("@/lib/hr-payslip-ytd").PayslipYtdSummary }>;
  myYtd: import("@/lib/hr-payslip-ytd").PayslipYtdSummary | null;
  payslipRuns: Array<{
    id: string;
    label: string;
    year: number;
    month: number;
    status: string;
    statusValue: string;
    payslipCount: number;
    adjustments: Array<{
      id: string;
      employeeProfileId: string;
      type: "EARNING" | "DEDUCTION";
      label: string;
      amount: number;
      taxable: boolean;
      pensionable: boolean;
      preTax: boolean;
    }>;
    payslips: Array<{
      id: string;
      employeeProfileId: string;
      employeeName: string;
      jobRole: string;
      paygroup: string;
      employeeId: string;
      department: string;
      taxId: string;
      rsaPin: string;
      pensionAdministrator: string;
      nhfMembershipNumber: string;
      accountNumber: string;
      bankName: string;
      grossPay: number;
      netPay: number;
      paymentStatus: string;
      paymentStatusValue: string;
      paidAtLabel: string;
      paymentReference: string;
      calc: PayslipCalculation;
    }>;
  }>;
  documents: Array<{
    id: string;
    employeeProfileId: string;
    employeeName: string;
    category: string;
    categoryValue: string;
    title: string;
    fileUrl: string;
    fileName: string;
    uploadedAtLabel: string;
  }>;
  formRequests: Array<{
    id: string;
    employeeProfileId: string | null;
    employeeName: string;
    formType: string;
    formTypeLabel: string;
    deliveryMode: string;
    deliveryLabel: string;
    status: string;
    statusValue: string;
    expiresLabel: string;
    submittedAtLabel: string;
    hasFileUpload: boolean;
    submittedFileUrl: string | null;
    submittedPayload: Record<string, unknown> | null;
    reviewNote: string | null;
  }>;
  performanceGoals: PerformanceGoalRow[];
  profileOptions: Array<{ id: string; label: string; department: string }>;
  departments: string[];
  yearlyArchive: YearlyArchiveEntry[];
  staffPerformancePeriods: Array<{ year: number; month: number; label: string; start: string; end: string }>;
  staffPerformanceInput: {
    profiles: Array<{
      id: string;
      userId: string;
      fullName: string;
      department: string | null;
      position: string | null;
      status: string;
    }>;
    tasks: Array<{
      assigneeUserId: string | null;
      status: string;
      dueDate: Date | null;
      completedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
    appraisals: Array<{
      employeeProfileId: string;
      status: string;
      overallRating: number | null;
      actionScores: unknown;
      cycleType: string;
      periodLabel: string;
    }>;
    appraisalActionIds: string[];
    leads: Array<{ assignedUserId: string | null; createdAt: Date }>;
    deals: Array<{ assignedUserId: string | null; stage: string; value: unknown; updatedAt: Date }>;
    activities: Array<{ assignedUserId: string | null; completedAt: Date | null; createdAt: Date }>;
    goals: Array<{ employeeProfileId: string; progressPercent: number; status: string }>;
  };
  staffMonthlyScoresDefault: StaffMonthlyScoreEntry[];
  hrAnalytics: HrAnalyticsSnapshot;
  peopleOnboardUserId?: string;
  offerByUserId?: Record<
    string,
    {
      bodyHtml: string;
      status: "DRAFT" | "AWAITING_SIGNATURE" | "SIGNED";
      signUrl?: string;
      profileId: string;
    }
  >;
  documentsForUserId?: string;
  documentsReturnOnboardUserId?: string;
  myDashboardPreview?: { userId: string; name: string; email: string } | null;
  myView: {
    profile: ProfileDetailRow | null;
    leaveBalances: Array<{
      leaveTypeId: string;
      name: string;
      dayUnit: string;
      statutoryReference: string;
      accrued: number | null;
      carried: number;
      adjustment: number;
      approved: number;
      pending: number;
      available: number | null;
      unlimited: boolean;
    }>;
    leaveRequests: Array<{
      id: string;
      leaveTypeName: string;
      dayUnit: string;
      startDate: string;
      endDate: string;
      requestedUnits: number;
      reason: string;
      status: string;
      reviewNote: string;
    }>;
    payslips: Array<{
      id: string;
      periodLabel: string;
      calc: PayslipCalculation;
      employeeName: string;
      jobRole: string;
      paygroup: string;
      employeeId: string;
      accountNumber: string;
      bankName: string;
      paymentStatus: string;
      paymentStatusValue: string;
      paidAtLabel: string;
    }>;
    documents: Array<{
      id: string;
      category: string;
      title: string;
      fileUrl: string;
      uploadedAtLabel: string;
    }>;
    goals: Array<{
      id: string;
      title: string;
      progressPercent: number;
      status: string;
      dueDateLabel: string;
    }>;
    pendingForms: Array<{
      id: string;
      formTypeLabel: string;
      fillUrl: string;
      expiresLabel: string;
      progressLabel?: string;
      isMasterBundle?: boolean;
    }>;
    masterOnboardingUrl?: string | null;
    onboardingSummary?:
      | { state: "none" }
      | {
          state: "pending";
          pendingCount: number;
          sectionLabels: string[];
          dueLabel: string | null;
          masterUrl: string | null;
        }
      | {
          state: "complete";
          submittedCount: number;
          totalCount: number;
          submittedAtLabel: string;
          viewUrl: string | null;
        };
    pendingOfferSignUrl?: string | null;
    appraisals: Array<{
      id: string;
      periodLabel: string;
      cycleType: string;
      cycleTypeLabel: string;
      cycleStatus: string;
      dueDateLabel: string;
      status: string;
      statusValue: string;
      selfNotes: string;
      managerNotes: string;
      overallRating: number | null;
      actionScores: Record<string, { rating?: number; completed?: boolean }> | null;
    }>;
    appraisalActions: Array<{ id: string; title: string; description: string; cycleType: string }>;
  };
}) {
  const {
    tenantSlug,
    companyName,
    tenantBrand,
    currency,
    activeTab,
    canManageHr,
    aiEnabled,
    teamMembers,
    profiles,
    payTemplates,
    profileDetails,
    profileOnboarding,
    appraisalActions,
    appraisalCycles,
    payslipRuns,
    payrollReadyCount,
    missingGrossCount,
    paygroups,
    payrollReadyByPaygroup,
    unassignedPayrollCount,
    draftPayslipRunCount,
    ytdByUserId,
    myYtd,
    documents,
    formRequests,
    performanceGoals,
    profileOptions,
    departments,
    yearlyArchive,
    staffPerformancePeriods,
    staffPerformanceInput,
    staffMonthlyScoresDefault,
    hrAnalytics,
    peopleOnboardUserId,
    offerByUserId,
    documentsForUserId,
    documentsReturnOnboardUserId,
    myDashboardPreview,
    myView,
    initialMyTab,
  } = props;

  const headings: Record<HrTab, { title: string; subtitle: string }> = {
    people: {
      title: "People",
      subtitle: "Employee records — biodata, job, bank, and pay setup (Bo Properties forms).",
    },
    payslips: {
      title: "Payslips",
      subtitle: "Generate monthly payslips. Employees download from My HR after you finalize.",
    },
    remittances: {
      title: "Statutory remittances",
      subtitle: "PAYE, pension, NHF, and NSITF schedules for the payroll month — export and file.",
    },
    appraisals: {
      title: "Appraisals",
      subtitle: "Monthly performance scores, manager reviews, and yearly archive.",
    },
    documents: { title: "Documents", subtitle: "NDAs, offer letters, guarantor forms, and other HR files." },
    insights: {
      title: "Insights",
      subtitle: "Headcount, joiners, appraisal backlog, and employee register export.",
    },
    my: { title: "My HR", subtitle: "Review your leave days, payslips, salary bank account, and HR record." },
  };

  const heading = headings[activeTab];

  const documentEmployees = useMemo(() => {
    const profileByUserId = new Map(profiles.map((p) => [p.userId, p]));
    return teamMembers
      .map((m) => {
        const p = profileByUserId.get(m.userId);
        return {
          profileId: p?.id ?? null,
          userId: m.userId,
          fullName: p?.fullName || m.name,
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [teamMembers, profiles]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:py-5">
      <div className="border-b border-foreground/10 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{heading.title}</h1>
        <p className="mt-0.5 text-sm text-muted">{heading.subtitle}</p>
      </div>

      <section className="mt-6 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 sm:p-5">
        {activeTab === "people" && canManageHr ? (
          <HrPeopleWorkspace
            tenantSlug={tenantSlug}
            companyName={companyName}
            tenantBrand={tenantBrand}
            currency={currency}
            teamMembers={teamMembers}
            profiles={profiles}
            payTemplates={payTemplates}
            profileDetails={profileDetails}
            profileOnboarding={profileOnboarding}
            ytdByUserId={ytdByUserId}
            formRequests={formRequests}
            initialOnboardUserId={peopleOnboardUserId}
            offerByUserId={offerByUserId}
            aiEnabled={aiEnabled}
            departments={departments}
          />
        ) : null}

        {activeTab === "people" && !canManageHr ? (
          <p className="text-sm text-muted">
            People records are managed by HR. Use My HR for your own information.
          </p>
        ) : null}

        {activeTab === "payslips" && canManageHr ? (
          <HrPayslipsWorkspace
            tenantSlug={tenantSlug}
            companyName={companyName}
            tenantBrand={tenantBrand}
            currency={currency}
            payslipRuns={payslipRuns}
            payrollReadyCount={payrollReadyCount}
            missingGrossCount={missingGrossCount}
            paygroups={paygroups}
            payrollReadyByPaygroup={payrollReadyByPaygroup}
            unassignedPayrollCount={unassignedPayrollCount}
            draftPayslipRunCount={draftPayslipRunCount}
          />
        ) : null}

        {activeTab === "remittances" && canManageHr ? (
          <HrRemittancesWorkspace
            tenantSlug={tenantSlug}
            companyName={companyName}
            currency={currency}
            payslipRuns={payslipRuns}
          />
        ) : null}

        {activeTab === "payslips" && !canManageHr ? (
          <p className="text-sm text-muted">Payslip runs are managed by HR. Open My HR to download yours.</p>
        ) : null}

        {activeTab === "remittances" && !canManageHr ? (
          <p className="text-sm text-muted">Remittance schedules are managed by HR.</p>
        ) : null}

        {activeTab === "appraisals" && canManageHr ? (
          <HrAppraisalsWorkspace
            tenantSlug={tenantSlug}
            currency={currency}
            appraisalActions={appraisalActions}
            appraisalCycles={appraisalCycles}
            performanceGoals={performanceGoals}
            profileOptions={profileOptions}
            departments={departments}
            yearlyArchive={yearlyArchive}
            staffPerformancePeriods={staffPerformancePeriods}
            staffPerformanceInput={staffPerformanceInput}
            staffMonthlyScoresDefault={staffMonthlyScoresDefault}
          />
        ) : null}

        {activeTab === "appraisals" && !canManageHr ? (
          <p className="text-sm text-muted">
            Appraisals are completed from My HR when HR opens a review period.
          </p>
        ) : null}

        {activeTab === "documents" && canManageHr ? (
          <HrDocumentsWorkspace
            tenantSlug={tenantSlug}
            employees={documentEmployees}
            documents={documents}
            preselectUserId={documentsForUserId}
            returnOnboardUserId={documentsReturnOnboardUserId}
            pendingReviewCount={formRequests.filter((request) => request.statusValue === "SUBMITTED").length}
            aiEnabled={aiEnabled}
          />
        ) : null}

        {activeTab === "documents" && !canManageHr ? (
          <p className="text-sm text-muted">HR documents are managed by your HR team.</p>
        ) : null}

        {activeTab === "insights" && canManageHr ? (
          <HrInsightsWorkspace tenantSlug={tenantSlug} analytics={hrAnalytics} />
        ) : null}

        {activeTab === "insights" && !canManageHr ? (
          <p className="text-sm text-muted">HR insights are available to HR administrators.</p>
        ) : null}

        {activeTab === "my" ? (
          <HrMyDashboard
            key={`${previewAs?.userId ?? "self"}:${initialMyTab ?? "overview"}`}
            tenantSlug={tenantSlug}
            companyName={companyName}
            tenantBrand={tenantBrand}
            currency={currency}
            canManageHr={canManageHr}
            myYtd={myYtd}
            myView={myView}
            previewAs={myDashboardPreview}
            initialTab={initialMyTab}
          />
        ) : null}
      </section>
    </div>
  );
}
