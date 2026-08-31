"use client";

import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PayslipPrintView } from "@/components/hr/payslip-print-view";
import { PdfDownloadButton } from "@/components/pdf-download-button";
import { PayslipYtdCard } from "@/components/hr/payslip-ytd-card";
import type { PayslipYtdSummary } from "@/lib/hr-payslip-ytd";
import { useSnackbar } from "@/components/snackbar";
import type { PayslipCalculation } from "@/lib/hr-payslip";
import type { ProfileDetailRow } from "@/lib/hr-profile-form";
import type { TenantBranding } from "@/lib/tenant-branding";
import { saveSelfAppraisal, updateMyStatutoryIds } from "@/app/[tenantSlug]/hr/actions";
import {
  cancelLeaveRequest,
  getLeaveUploadSignature,
  requestLeave,
} from "@/app/[tenantSlug]/hr/leave-actions";
import { AppraisalRatingSelect } from "@/components/hr/appraisal-rating-select";
import { FileDropZone } from "@/components/hr/file-drop-zone";
import { ButtonSpinner } from "@/components/button-spinner";
import { PensionAdministratorField } from "@/components/pension-administrator-field";
import { ModalOverlay } from "@/components/modal-overlay";
import { RichTextDisplay, RichTextField } from "@/components/rich-text-field";
import { uploadViaCloudinarySignature } from "@/lib/cloudinary-upload-client";
import { MODAL_PANEL_FORM } from "@/lib/modal-panel";
import { groupAppraisalActionsBySection, parseSelfAppraisalFormData } from "@/lib/appraisal-form-utils";
import { appraisalRatingLabel } from "@/lib/appraisal-competencies";
import {
  getManagerRating,
  getSelfRating,
  parseActionScores,
  type AppraisalCriterionScore,
} from "@/lib/appraisal-scores";

type MyTab = "overview" | "leave" | "payslips" | "record" | "documents" | "appraisals";
type RecordSection = "personal" | "job" | "bank" | "emergency" | "kin" | "ids";

type LeaveBalanceRow = {
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
};

type LeaveRequestRow = {
  id: string;
  leaveTypeName: string;
  dayUnit: string;
  startDate: string;
  endDate: string;
  requestedUnits: number;
  reason: string;
  status: string;
  reviewNote: string;
};

function parseMyTab(value?: string | null): { tab: MyTab; recordSection?: RecordSection } {
  const view = (value || "").trim().toLowerCase();
  if (view === "leave") return { tab: "leave" };
  if (view === "payslips" || view === "payslip") return { tab: "payslips" };
  if (view === "bank") return { tab: "record", recordSection: "bank" };
  if (view === "record" || view === "profile") return { tab: "record" };
  if (view === "documents") return { tab: "documents" };
  if (view === "appraisals") return { tab: "appraisals" };
  return { tab: "overview" };
}

function leaveUnitLabel(dayUnit: string, count = 0) {
  if (dayUnit === "HOURS") return count === 1 ? "hour" : "hours";
  if (dayUnit === "CALENDAR_DAYS") return count === 1 ? "calendar day" : "calendar days";
  return count === 1 ? "working day" : "working days";
}

function leaveStatusClass(status: string) {
  if (status === "APPROVED") return "bg-[var(--success-wash)] text-[var(--success)]";
  if (status === "REJECTED" || status === "CANCELLED") return "bg-foreground/[0.06] text-muted";
  return "bg-[var(--warn-wash)] text-[var(--warn)]";
}

const inputClass =
  "w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20";

function ReadRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="border-b border-foreground/10 py-2.5 last:border-0">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-0.5 text-sm text-foreground">{value?.trim() ? value : "—"}</p>
    </div>
  );
}

export function HrMyDashboard({
  tenantSlug,
  companyName,
  tenantBrand,
  currency,
  myView,
  canManageHr = false,
  myYtd = null,
  previewAs = null,
  initialTab,
  pensionAdministrators = [],
}: {
  tenantSlug: string;
  companyName: string;
  tenantBrand: TenantBranding;
  currency: string;
  canManageHr?: boolean;
  myYtd?: PayslipYtdSummary | null;
  previewAs?: { userId: string; name: string; email: string } | null;
  initialTab?: string;
  pensionAdministrators?: string[];
  myView: {
    profile: ProfileDetailRow | null;
    leaveBalances?: LeaveBalanceRow[];
    leaveRequests?: LeaveRequestRow[];
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
      actionScores: Record<string, AppraisalCriterionScore> | null;
    }>;
    appraisalActions: Array<{
      id: string;
      title: string;
      description: string;
      cycleType: string;
      sortOrder?: number;
    }>;
  };
}) {
  const { showSnackbar } = useSnackbar();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view") || initialTab || "";
  const resolvedInitial = parseMyTab(viewParam);
  const [tab, setTab] = useState<MyTab>(resolvedInitial.tab);
  const [recordSection, setRecordSection] = useState<RecordSection>(resolvedInitial.recordSection ?? "personal");
  const [viewPayslipId, setViewPayslipId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showLeaveRequest, setShowLeaveRequest] = useState(false);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const router = useRouter();
  const leaveBalances = myView.leaveBalances ?? [];
  const leaveRequests = myView.leaveRequests ?? [];

  useEffect(() => {
    const next = parseMyTab(viewParam);
    setTab(next.tab);
    if (next.recordSection) setRecordSection(next.recordSection);
  }, [viewParam]);

  const viewPayslip = viewPayslipId ? myView.payslips.find((p) => p.id === viewPayslipId) : null;

  const openAppraisals = myView.appraisals.filter(
    (a) => a.cycleStatus === "OPEN" && a.statusValue !== "REVIEWED",
  );

  const onboarding = myView.onboardingSummary ?? { state: "none" as const };
  const onboardingPending = onboarding.state === "pending";
  const onboardingComplete = onboarding.state === "complete";

  const pendingActionCount =
    (onboardingPending ? onboarding.pendingCount : 0) + (myView.pendingOfferSignUrl ? 1 : 0);

  function scrollToActionRequired() {
    requestAnimationFrame(() => {
      document
        .getElementById("my-hr-action-required")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const tabs: { id: MyTab; label: string; badge?: number }[] = [
    { id: "overview", label: "Overview", badge: pendingActionCount || undefined },
    {
      id: "leave",
      label: "Leave days",
      badge: leaveRequests.filter((request) => request.status === "PENDING").length || undefined,
    },
    { id: "payslips", label: "Payslips", badge: myView.payslips.length || undefined },
    { id: "record", label: "My record" },
    { id: "documents", label: "Documents", badge: myView.documents.length || undefined },
    {
      id: "appraisals",
      label: "Appraisals",
      badge: openAppraisals.length || undefined,
    },
  ];

  const actionsByCycleType = useMemo(() => {
    const map = new Map<string, typeof myView.appraisalActions>();
    for (const a of myView.appraisalActions) {
      const list = map.get(a.cycleType) ?? [];
      list.push(a);
      map.set(a.cycleType, list);
    }
    return map;
  }, [myView.appraisalActions]);

  async function submitAppraisal(appraisalId: string, form: HTMLFormElement) {
    const fd = new FormData(form);
    const actions =
      actionsByCycleType.get(myView.appraisals.find((a) => a.id === appraisalId)?.cycleType ?? "") ?? [];
    const { selfNotes, actionResponses } = parseSelfAppraisalFormData(
      fd,
      actions.map((a) => a.id),
    );
    setPending(true);
    const result = await saveSelfAppraisal(tenantSlug, appraisalId, {
      selfNotes,
      actionResponses,
    });
    setPending(false);
    if (!result.ok) {
      showSnackbar(result.error || "Could not save.", "error");
      return;
    }
    showSnackbar("Your self-appraisal was submitted.", "success");
  }

  async function saveStatutoryIds(form: HTMLFormElement) {
    const fd = new FormData(form);
    setPending(true);
    const result = await updateMyStatutoryIds(tenantSlug, {
      taxId: String(fd.get("taxId") ?? ""),
      rsaPin: String(fd.get("rsaPin") ?? ""),
      pensionAdministrator: String(fd.get("pensionAdministrator") ?? ""),
      nhfMembershipNumber: String(fd.get("nhfMembershipNumber") ?? ""),
    });
    setPending(false);
    if (!result.ok) {
      showSnackbar(result.error || "Could not save.", "error");
      return;
    }
    showSnackbar("Tax and pension IDs saved.", "success");
    router.refresh();
  }

  async function submitLeaveRequest(form: HTMLFormElement) {
    setPending(true);
    try {
      let attachmentUrl = "";
      if (evidenceFile) {
        const signature = await getLeaveUploadSignature(tenantSlug, evidenceFile.name);
        if (!signature.ok) {
          showSnackbar(signature.error, "error");
          return;
        }
        const upload = await uploadViaCloudinarySignature(evidenceFile, signature);
        if (!upload.ok) {
          showSnackbar(upload.error, "error");
          return;
        }
        attachmentUrl = upload.secureUrl;
      }
      const data = new FormData(form);
      const result = await requestLeave(tenantSlug, {
        leaveTypeId: String(data.get("leaveTypeId") || ""),
        startDate: String(data.get("startDate") || ""),
        endDate: String(data.get("endDate") || ""),
        reason: String(data.get("reason") || ""),
        requestedHours: String(data.get("requestedHours") || "") || undefined,
        attachmentUrl,
      });
      if (!result.ok) {
        showSnackbar(result.error, "error");
        return;
      }
      showSnackbar("Leave request sent to HR.", "success");
      setShowLeaveRequest(false);
      setEvidenceFile(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function onCancelLeave(requestId: string) {
    setPending(true);
    const result = await cancelLeaveRequest(tenantSlug, requestId);
    setPending(false);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      return;
    }
    showSnackbar("Leave request cancelled.", "success");
    router.refresh();
  }

  if (!myView.profile) {
    return (
      <div className="rounded-xl border border-[var(--warn-line)] bg-[var(--warn-wash)] p-6 text-center">
        {canManageHr ? (
          <>
            <p className="text-sm font-semibold text-foreground">No personal HR record for this login</p>
            <p className="mt-2 text-sm text-muted">
              You are signed in as HR admin. Use <strong>People</strong> to manage staff. My HR is only
              for team members who have an employee record (including you, if you are also on payroll).
            </p>
            <Link
              href={`/${tenantSlug}/hr/people`}
              className="mt-4 inline-block rounded-md border border-foreground/15 px-3 py-2 text-xs font-semibold hover:bg-foreground/[0.06]"
            >
              Go to People
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-foreground">Your HR record is not set up yet</p>
            <p className="mt-2 text-sm text-muted">
              Your HR record is being set up. Complete any forms below, or ask HR to finish onboarding from
              People.
            </p>
          </>
        )}
        {onboardingPending || onboardingComplete || myView.pendingOfferSignUrl ? (
          <div className="mt-4 text-left">
            {onboardingComplete ? (
              <p className="text-sm text-[var(--success)]">Onboarding forms submitted — HR will review.</p>
            ) : null}
            {onboardingPending && onboarding.state === "pending" && onboarding.masterUrl ? (
              <>
                <p className="text-xs font-semibold text-foreground">Action required</p>
                <a
                  href={onboarding.masterUrl}
                  className="mt-2 inline-block rounded-md border border-foreground bg-foreground px-3 py-2 text-sm font-semibold text-background"
                >
                  Continue onboarding
                </a>
              </>
            ) : null}
            <ul className="mt-2 space-y-2">
              {myView.pendingOfferSignUrl ? (
                <li>
                  <a
                    href={myView.pendingOfferSignUrl}
                    className="text-sm font-semibold text-foreground underline"
                  >
                    Offer letter — sign online
                  </a>
                </li>
              ) : null}
              {!myView.masterOnboardingUrl
                ? myView.pendingForms.map((f) => (
                    <li key={f.id}>
                      <a href={f.fillUrl} className="text-sm font-semibold text-foreground underline">
                        {f.formTypeLabel} — complete by {f.expiresLabel}
                      </a>
                    </li>
                  ))
                : null}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  const p = myView.profile;
  if (!p) return null;

  const annualLeave =
    leaveBalances.find((balance) => /annual/i.test(balance.name) || /ANNUAL/i.test(balance.statutoryReference)) ??
    leaveBalances.find((balance) => !balance.unlimited);
  const pendingLeaveCount = leaveRequests.filter((request) => request.status === "PENDING").length;
  const salaryBankListed = Boolean(p.bankName?.trim() && p.bankAccountNumber?.trim());
  const missingOnFile: Array<{ label: string; section: RecordSection; canSelfUpdate?: boolean }> = [];
  if (!salaryBankListed) missingOnFile.push({ label: "Salary bank account", section: "bank" });
  if (![p.addressStreet, p.addressCity].some((value) => value?.trim())) {
    missingOnFile.push({ label: "Home address", section: "personal" });
  }
  if (!p.emergencyName?.trim() || !p.emergencyPhone?.trim()) {
    missingOnFile.push({ label: "Emergency contact", section: "emergency" });
  }
  if (!p.nextOfKinName?.trim() || !p.nextOfKinPhone?.trim()) {
    missingOnFile.push({ label: "Next of kin", section: "kin" });
  }
  if (!p.taxId?.trim()) missingOnFile.push({ label: "Tax identification number (TIN)", section: "ids", canSelfUpdate: true });
  if (!p.rsaPin?.trim()) missingOnFile.push({ label: "RSA PIN", section: "ids", canSelfUpdate: true });

  const missingBanner = missingOnFile.length > 0 ? (
    <div className="rounded-lg border border-[var(--warn-line)] bg-[var(--warn-wash)] p-4">
      <p className="text-sm font-semibold text-foreground">Not listed on your record</p>
      <p className="mt-1 text-sm text-muted">
        Review what HR has on file. Ask HR to add anything you cannot update yourself.
      </p>
      <ul className="mt-3 space-y-1.5">
        {missingOnFile.map((item) => (
          <li key={item.label}>
            <button
              type="button"
              onClick={() => {
                setRecordSection(item.section);
                setTab("record");
              }}
              className="text-sm font-semibold text-foreground underline"
            >
              {item.label}
            </button>
            <span className="text-xs text-muted">
              {item.canSelfUpdate ? " — you can add this under Tax & pension" : " — HR maintains this"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      {previewAs ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--warn-line)] bg-[var(--warn-wash)] px-4 py-3">
          <p className="text-sm text-foreground">
            <strong>HR preview</strong> — {previewAs.name}&apos;s dashboard ({previewAs.email}). This is not
            your login.
          </p>
          <Link href={`/${tenantSlug}/hr/people`} className="text-xs font-semibold underline">
            ← Back to People
          </Link>
        </div>
      ) : null}
      <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
        <p className="text-lg font-semibold text-foreground">{p.fullName}</p>
        <p className="text-sm text-muted">
          {p.position || "Team member"}
          {p.department ? ` · ${p.department}` : ""}
        </p>
        {p.employeeNumber ? <p className="mt-1 text-xs text-muted">Employee ID: {p.employeeNumber}</p> : null}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-foreground/10 pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-foreground text-background"
                : "text-muted hover:bg-foreground/[0.06] hover:text-foreground",
            ].join(" ")}
          >
            {t.label}
            {t.badge ? (
              <span
                className={[
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  tab === t.id ? "bg-background/20 text-background" : "bg-foreground/10 text-foreground",
                ].join(" ")}
              >
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <div className="space-y-3">
          {onboardingComplete ? (
            <div className="rounded-lg border border-[var(--success-line)] bg-[var(--success-wash)] p-4">
              <p className="text-sm font-semibold text-[var(--success)]">Onboarding forms complete</p>
              <p className="mt-1 text-sm text-[var(--success)]">
                You submitted {onboarding.submittedCount} section{onboarding.submittedCount === 1 ? "" : "s"}.
                HR will review your information
                {onboarding.submittedAtLabel !== "—" ? ` (last update ${onboarding.submittedAtLabel})` : ""}.
              </p>
              {onboarding.viewUrl ? (
                <a
                  href={onboarding.viewUrl}
                  className="mt-2 inline-block text-xs font-semibold text-[var(--success)] underline"
                >
                  View submitted forms
                </a>
              ) : null}
            </div>
          ) : null}
          {pendingActionCount > 0 ? (
            onboardingPending && onboarding.masterUrl ? (
              <a
                href={onboarding.masterUrl}
                className="block w-full rounded-lg border border-[var(--accent-line)] bg-[var(--accent-wash)] p-4 text-left hover:bg-[var(--accent-wash)] sm:col-span-2 lg:col-span-4"
              >
                <p className="text-2xl font-bold text-foreground">{onboarding.pendingCount}</p>
                <p className="text-xs text-muted">
                  Onboarding section{onboarding.pendingCount === 1 ? "" : "s"} still to complete
                  {onboarding.dueLabel ? ` · due ${onboarding.dueLabel}` : ""}
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground underline">Continue onboarding →</p>
              </a>
            ) : (
              <button
                type="button"
                onClick={scrollToActionRequired}
                className="w-full rounded-lg border border-[var(--accent-line)] bg-[var(--accent-wash)] p-4 text-left hover:bg-[var(--accent-wash)] sm:col-span-2 lg:col-span-4"
              >
                <p className="text-2xl font-bold text-foreground">{pendingActionCount}</p>
                <p className="text-xs text-muted">Forms or offer waiting for you — tap to view</p>
              </button>
            )
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => setTab("leave")}
              className="rounded-lg border border-foreground/10 p-4 text-left hover:bg-foreground/[0.03]"
            >
              <CalendarDays className="h-5 w-5 text-muted" />
              <p className="mt-2 text-2xl font-bold text-foreground">
                {annualLeave?.unlimited
                  ? "Unlimited"
                  : annualLeave?.available != null
                    ? annualLeave.available
                    : "—"}
              </p>
              <p className="text-xs text-muted">
                {annualLeave
                  ? `${annualLeave.name} remaining`
                  : "Leave days — request time away"}
                {pendingLeaveCount ? ` · ${pendingLeaveCount} pending` : ""}
              </p>
            </button>
            <button
              type="button"
              onClick={() => setTab("payslips")}
              className="rounded-lg border border-foreground/10 p-4 text-left hover:bg-foreground/[0.03]"
            >
              <p className="text-2xl font-bold text-foreground">{myView.payslips.length}</p>
              <p className="text-xs text-muted">Payslips to review</p>
            </button>
            <button
              type="button"
              onClick={() => {
                setRecordSection("bank");
                setTab("record");
              }}
              className="rounded-lg border border-foreground/10 p-4 text-left hover:bg-foreground/[0.03]"
            >
              <p className="text-sm font-semibold text-foreground">
                {salaryBankListed ? p.bankName : "Not listed"}
              </p>
              <p className="mt-1 font-mono text-sm text-foreground">
                {p.bankAccountNumber?.trim() ? p.bankAccountNumber : "No salary account on file"}
              </p>
              <p className="mt-1 text-xs text-muted">Salary bank account</p>
            </button>
            <button
              type="button"
              onClick={() => setTab("documents")}
              className="rounded-lg border border-foreground/10 p-4 text-left hover:bg-foreground/[0.03]"
            >
              <p className="text-2xl font-bold text-foreground">{myView.documents.length}</p>
              <p className="text-xs text-muted">HR documents</p>
            </button>
            <button
              type="button"
              onClick={() => setTab("appraisals")}
              className="rounded-lg border border-foreground/10 p-4 text-left hover:bg-foreground/[0.03]"
            >
              <p className="text-2xl font-bold text-foreground">{openAppraisals.length}</p>
              <p className="text-xs text-muted">Appraisals to complete</p>
            </button>
            <button
              type="button"
              onClick={() => setTab("record")}
              className="rounded-lg border border-foreground/10 p-4 text-left hover:bg-foreground/[0.03]"
            >
              <p className="text-2xl font-bold text-foreground">{missingOnFile.length ? missingOnFile.length : "✓"}</p>
              <p className="text-xs text-muted">
                {missingOnFile.length ? "Items not listed on your record" : "View my record"}
              </p>
            </button>
          </div>
          {missingBanner}
        </div>
      ) : null}

      {tab === "overview" && (onboardingPending || myView.pendingOfferSignUrl) ? (
        <div
          id="my-hr-action-required"
          className="rounded-lg border border-[var(--accent-line)] bg-[var(--accent-wash)] p-4"
        >
          <p className="text-sm font-semibold text-foreground">Action required — from HR</p>
          {onboardingPending && onboarding.masterUrl ? (
            <a
              href={onboarding.masterUrl}
              className="mt-3 flex w-full items-center justify-center rounded-md border border-foreground bg-foreground px-4 py-3 text-sm font-semibold text-background"
            >
              Continue onboarding ({onboarding.pendingCount} section{onboarding.pendingCount === 1 ? "" : "s"}{" "}
              left)
            </a>
          ) : null}
          <ul className="mt-2 space-y-2">
            {myView.pendingOfferSignUrl ? (
              <li className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>Offer of employment</span>
                <a
                  href={myView.pendingOfferSignUrl}
                  className="rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background"
                >
                  Review & sign
                </a>
              </li>
            ) : null}
            {!myView.masterOnboardingUrl
              ? myView.pendingForms.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>
                      {f.formTypeLabel} <span className="text-muted">(due {f.expiresLabel})</span>
                    </span>
                    <a
                      href={f.fillUrl}
                      className="rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background"
                    >
                      Complete form
                    </a>
                  </li>
                ))
              : null}
          </ul>
        </div>
      ) : null}

      {tab === "overview" && myYtd ? <PayslipYtdCard ytd={myYtd} currency={currency} /> : null}

      {tab === "overview" && myView.goals.length > 0 ? (
        <div className="rounded-lg border border-foreground/10 p-4">
          <p className="text-sm font-semibold text-foreground">Performance goals</p>
          <ul className="mt-2 space-y-2 text-sm">
            {myView.goals.map((g) => (
              <li key={g.id} className="flex justify-between gap-2">
                <span>{g.title}</span>
                <span className="text-muted">{g.progressPercent}%</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === "leave" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Your leave days</p>
              <p className="text-xs text-muted">Balances for this year, recent requests, and HR decisions.</p>
            </div>
            {previewAs ? null : (
            <button
              type="button"
              onClick={() => setShowLeaveRequest(true)}
              className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              <Plus className="h-4 w-4" />
              Request leave
            </button>
            )}
          </div>
          {leaveBalances.length === 0 ? (
            <p className="text-sm text-muted">Leave policies are not on your record yet. Ask HR to set them up.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {leaveBalances.map((balance) => (
                <article key={balance.leaveTypeId} className="rounded-lg border border-foreground/10 p-4">
                  <p className="text-sm font-semibold text-foreground">{balance.name}</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">
                    {balance.unlimited ? "Unlimited" : balance.available ?? "—"}
                  </p>
                  <p className="text-xs text-muted">
                    {balance.unlimited
                      ? "No balance cap"
                      : `${leaveUnitLabel(balance.dayUnit, balance.available ?? 0)} remaining`}
                  </p>
                  {!balance.unlimited ? (
                    <p className="mt-2 text-[11px] text-muted">
                      Accrued {balance.accrued ?? 0}
                      {balance.carried ? ` · carried ${balance.carried}` : ""}
                      {balance.approved ? ` · used ${balance.approved}` : ""}
                      {balance.pending ? ` · pending ${balance.pending}` : ""}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
          <div className="rounded-lg border border-foreground/10">
            <p className="border-b border-foreground/10 px-4 py-3 text-sm font-semibold text-foreground">
              Recent requests
            </p>
            {leaveRequests.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">You have not requested leave yet.</p>
            ) : (
              <ul className="divide-y divide-foreground/10">
                {leaveRequests.map((request) => (
                  <li key={request.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {request.leaveTypeName} · {request.startDate} – {request.endDate}
                      </p>
                      <p className="text-xs text-muted">
                        {request.requestedUnits} {leaveUnitLabel(request.dayUnit, request.requestedUnits)}
                        {request.reason ? ` · ${request.reason}` : ""}
                      </p>
                      {request.reviewNote ? (
                        <p className="mt-1 text-xs text-muted">HR note: {request.reviewNote}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${leaveStatusClass(request.status)}`}
                      >
                        {request.status}
                      </span>
                      {request.status === "PENDING" && !previewAs ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => void onCancelLeave(request.id)}
                          className="text-xs font-semibold text-muted underline disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {tab === "payslips" ? (
        myView.payslips.length === 0 ? (
          <p className="text-sm text-muted">
            No finalized payslips yet. They appear here after HR publishes each month.
          </p>
        ) : (
          <div className="space-y-4">
            {myYtd ? <PayslipYtdCard ytd={myYtd} currency={currency} /> : null}
            <div className="space-y-2">
              {myView.payslips.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-foreground/10 px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-foreground">{s.periodLabel}</p>
                    <p className="text-xs text-muted">
                      Net pay: {currency}{" "}
                      {s.calc.netPay.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="mt-1 text-[10px] font-medium">
                      {s.paymentStatusValue === "PAID" ? (
                        <span className="text-[var(--success)]">Salary paid · {s.paidAtLabel}</span>
                      ) : (
                        <span className="text-[var(--warn)]">Payment processing</span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewPayslipId(s.id)}
                    className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold hover:bg-foreground/[0.06]"
                  >
                    View & download
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      ) : null}

      {tab === "record" ? (
        <div>
          <p className="mb-3 text-xs text-muted">
            Review the personal, job, salary bank, and emergency details HR has on file. You can add or update
            your TIN and RSA PIN here for PAYE and pension remittances.
          </p>
          {missingBanner ? <div className="mb-3">{missingBanner}</div> : null}
          <div className="mb-3 flex flex-wrap gap-1">
            {(
              [
                ["personal", "Personal"],
                ["job", "Job"],
                ["bank", "Salary bank"],
                ["emergency", "Emergency"],
                ["kin", "Next of kin"],
                ["ids", "Tax & pension"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setRecordSection(id)}
                className={[
                  "rounded-md px-2.5 py-1.5 text-xs font-medium",
                  recordSection === id ? "bg-foreground/10 text-foreground" : "text-muted",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="rounded-lg border border-foreground/10 px-4">
            {recordSection === "personal" ? (
              <>
                <ReadRow label="Full name" value={p.fullName} />
                <ReadRow label="Mobile" value={p.phoneMobile} />
                <ReadRow label="Work email" value={p.workEmail} />
                <ReadRow
                  label="Address"
                  value={[p.addressStreet, p.addressCity, p.addressState, p.addressCountry]
                    .filter(Boolean)
                    .join(", ")}
                />
              </>
            ) : null}
            {recordSection === "job" ? (
              <>
                <ReadRow label="Job title" value={p.position} />
                <ReadRow label="Department" value={p.department} />
                <ReadRow label="Date of joining" value={p.dateOfJoining} />
                <ReadRow
                  label="Monthly gross pay"
                  value={p.grossMonthly ? `${currency} ${Number(p.grossMonthly).toLocaleString()}` : null}
                />
              </>
            ) : null}
            {recordSection === "bank" ? (
              <>
                <ReadRow label="Account holder" value={p.bankAccountHolderName} />
                <ReadRow label="Bank" value={p.bankName} />
                <ReadRow label="Account number (salary)" value={p.bankAccountNumber} />
                <ReadRow label="Account type" value={p.bankAccountType} />
                {!salaryBankListed ? (
                  <p className="py-3 text-sm text-[var(--warn)]">
                    No salary bank account is listed. Ask HR to add the account that should receive your pay.
                  </p>
                ) : null}
              </>
            ) : null}
            {recordSection === "emergency" ? (
              <>
                <ReadRow label="Emergency contact" value={p.emergencyName} />
                <ReadRow label="Relationship" value={p.emergencyRelationship} />
                <ReadRow label="Phone" value={p.emergencyPhone} />
                <ReadRow label="Email" value={p.emergencyEmail} />
              </>
            ) : null}
            {recordSection === "kin" ? (
              <>
                <ReadRow label="Next of kin" value={p.nextOfKinName} />
                <ReadRow label="Relationship" value={p.nextOfKinRelationship} />
                <ReadRow label="Phone" value={p.nextOfKinPhone} />
                <ReadRow label="Email" value={p.nextOfKinEmail} />
                <ReadRow label="Occupation" value={p.nextOfKinOccupation} />
                <ReadRow
                  label="Address"
                  value={[p.nextOfKinStreet, p.nextOfKinCity, p.nextOfKinState, p.nextOfKinCountry]
                    .filter(Boolean)
                    .join(", ")}
                />
              </>
            ) : null}
            {recordSection === "ids" ? (
              previewAs ? (
                <>
                  <ReadRow label="Tax identification number (TIN)" value={p.taxId} />
                  <ReadRow label="RSA PIN" value={p.rsaPin} />
                  <ReadRow label="Pension administrator (PFA)" value={p.pensionAdministrator} />
                  <ReadRow label="NHF membership number" value={p.nhfMembershipNumber} />
                </>
              ) : (
                <form
                  className="grid gap-3 py-3 sm:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveStatutoryIds(event.currentTarget);
                  }}
                >
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium text-muted">
                      Tax identification number (TIN)
                    </span>
                    <input name="taxId" defaultValue={p.taxId} className={inputClass} />
                  </label>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium text-muted">RSA PIN</span>
                    <input name="rsaPin" defaultValue={p.rsaPin} placeholder="PEN…" className={inputClass} />
                  </label>
                  <div className="sm:col-span-2">
                    <PensionAdministratorField
                      defaultValue={p.pensionAdministrator}
                      options={pensionAdministrators}
                    />
                  </div>
                  <label className="text-sm">
                    <span className="mb-1 block text-xs font-medium text-muted">NHF membership number</span>
                    <input
                      name="nhfMembershipNumber"
                      defaultValue={p.nhfMembershipNumber}
                      className={inputClass}
                    />
                  </label>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-md border border-foreground bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-50"
                    >
                      {pending ? "Saving…" : "Save tax & pension IDs"}
                    </button>
                  </div>
                </form>
              )
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "documents" ? (
        myView.documents.length === 0 ? (
          <p className="text-sm text-muted">No documents on file yet (offer letter, NDA, etc.).</p>
        ) : (
          <ul className="divide-y divide-foreground/10 rounded-lg border border-foreground/10">
            {myView.documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">{d.title}</p>
                  <p className="text-xs text-muted">
                    {d.category} · {d.uploadedAtLabel}
                  </p>
                </div>
                <Link href={d.fileUrl} target="_blank" className="text-xs font-semibold underline">
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {tab === "appraisals" ? (
        myView.appraisals.length === 0 ? (
          <p className="text-sm text-muted">No appraisals assigned yet.</p>
        ) : (
          <div className="space-y-4">
            {myView.appraisals.map((a) => {
              const actions = actionsByCycleType.get(a.cycleType) ?? [];
              const canEdit = a.cycleStatus === "OPEN" && a.statusValue !== "REVIEWED";
              const scores = parseActionScores(a.actionScores);
              const grouped = groupAppraisalActionsBySection(actions);

              return (
                <form
                  key={a.id}
                  className="rounded-lg border border-foreground/10 p-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!canEdit) return;
                    void submitAppraisal(a.id, e.currentTarget);
                  }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">
                        {a.cycleTypeLabel} — {a.periodLabel}
                      </p>
                      <p className="text-xs text-muted">
                        Status: {a.status}
                        {a.dueDateLabel !== "—" ? ` · Due ${a.dueDateLabel}` : ""}
                      </p>
                      {canEdit ? (
                        <p className="mt-1 text-xs text-muted">
                          Rate yourself 0–5 on each area, add examples, then submit to your line manager for
                          confirmation.
                        </p>
                      ) : null}
                    </div>
                    {!canEdit ? (
                      <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-medium uppercase">
                        {a.statusValue === "REVIEWED" ? "Reviewed" : "Submitted"}
                      </span>
                    ) : null}
                  </div>

                  {grouped.length > 0 ? (
                    <div className="mt-4 space-y-5">
                      {grouped.map((group) => (
                        <div key={group.section}>
                          <p className="text-xs font-bold uppercase tracking-wide text-muted">
                            {group.label}
                          </p>
                          <div className="mt-2 space-y-3">
                            {group.actions.map((action) => {
                              const score = scores[action.id];
                              const selfRating = getSelfRating(score);
                              return (
                                <div
                                  key={action.id}
                                  className="rounded-md border border-foreground/10 bg-foreground/[0.02] p-3"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-medium text-foreground">{action.title}</p>
                                      {action.description ? (
                                        <p className="mt-0.5 text-xs text-muted">{action.description}</p>
                                      ) : null}
                                    </div>
                                    {canEdit ? (
                                      <AppraisalRatingSelect
                                        name={`action_self_rating_${action.id}`}
                                        defaultValue={selfRating}
                                        className="min-w-[11rem] text-xs"
                                        placeholder="Your score"
                                      />
                                    ) : selfRating != null ? (
                                      <span className="text-xs font-medium text-muted">
                                        You: {appraisalRatingLabel(selfRating)}
                                      </span>
                                    ) : null}
                                  </div>
                                  {canEdit ? (
                                    <RichTextField
                                      name={`action_self_notes_${action.id}`}
                                      defaultValue={score?.selfNotes ?? ""}
                                      placeholder="Examples, outcomes, and supporting notes for this area…"
                                      minHeight="5rem"
                                      className="mt-2"
                                    />
                                  ) : score?.selfNotes ? (
                                    <div className="mt-2">
                                      <RichTextDisplay html={score.selfNotes} />
                                    </div>
                                  ) : null}
                                  {a.statusValue === "REVIEWED" && getManagerRating(score) != null ? (
                                    <p className="mt-2 text-xs text-muted">
                                      Final score: {appraisalRatingLabel(getManagerRating(score))}
                                    </p>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <RichTextField
                    name="selfNotes"
                    label="Additional comments (optional)"
                    defaultValue={a.selfNotes}
                    readOnly={!canEdit}
                    placeholder="Anything else for your line manager — context, goals, or requests for support."
                    minHeight="5rem"
                    className="mt-4"
                  />

                  {a.statusValue === "REVIEWED" && a.managerNotes ? (
                    <div className="mt-3 rounded-md bg-foreground/[0.04] p-3 text-sm">
                      <p className="text-xs font-semibold text-muted">Manager feedback</p>
                      <RichTextDisplay html={a.managerNotes} className="mt-1" />
                      {a.overallRating != null ? (
                        <p className="mt-2 text-xs text-muted">
                          Final overall rating: {appraisalRatingLabel(a.overallRating)}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {canEdit ? (
                    <button
                      type="submit"
                      disabled={pending}
                      aria-busy={pending}
                      className="mt-3 inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
                    >
                      {pending ? <ButtonSpinner /> : null}
                      {pending ? "Submitting…" : "Submit self-appraisal"}
                    </button>
                  ) : null}
                </form>
              );
            })}
          </div>
        )
      ) : null}

      {showLeaveRequest && !previewAs ? (
        <ModalOverlay
          open={showLeaveRequest}
          onClose={() => !pending && setShowLeaveRequest(false)}
          panelClassName={MODAL_PANEL_FORM}
          aria-labelledby="my-leave-request-title"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitLeaveRequest(event.currentTarget);
            }}
          >
            <div className="border-b border-foreground/10 px-5 py-4">
              <h2 id="my-leave-request-title" className="text-lg font-semibold text-foreground">
                Request leave
              </h2>
              <p className="text-sm text-muted">HR will review your dates, balance, and supporting evidence.</p>
            </div>
            <div className="grid gap-4 p-5">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium">Leave type</span>
                <select name="leaveTypeId" required className={inputClass}>
                  <option value="">Select policy</option>
                  {leaveBalances.map((balance) => (
                    <option key={balance.leaveTypeId} value={balance.leaveTypeId}>
                      {balance.name} ({balance.unlimited ? "unlimited" : `${balance.available} available`})
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium">Start date</span>
                  <input type="date" name="startDate" required className={inputClass} />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium">End date</span>
                  <input type="date" name="endDate" required className={inputClass} />
                </label>
              </div>
              {leaveBalances.some((balance) => balance.dayUnit === "HOURS") ? (
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium">Hours (hourly policies only)</span>
                  <input type="number" min="0.25" step="0.25" name="requestedHours" className={inputClass} />
                </label>
              ) : null}
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium">Reason</span>
                <textarea name="reason" rows={3} className={inputClass} placeholder="Add context for your approver" />
              </label>
              <div>
                <p className="mb-2 text-xs font-medium">Supporting evidence (if required)</p>
                <FileDropZone
                  onFile={setEvidenceFile}
                  uploading={pending}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  hint={evidenceFile ? evidenceFile.name : "PDF, image, or Word document"}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-foreground/10 px-5 py-4">
              <button
                type="button"
                disabled={pending}
                onClick={() => setShowLeaveRequest(false)}
                className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
              >
                {pending ? "Submitting…" : "Send request"}
              </button>
            </div>
          </form>
        </ModalOverlay>
      ) : null}

      {viewPayslip ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto max-w-3xl rounded-xl bg-white p-4 shadow-xl dark:bg-zinc-900">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="font-semibold text-foreground">{viewPayslip.periodLabel}</p>
              <button type="button" onClick={() => setViewPayslipId(null)} className="text-sm underline">
                Close
              </button>
            </div>
            <PayslipPrintView
              companyName={companyName}
              brand={tenantBrand}
              periodLabel={viewPayslip.periodLabel}
              employeeName={viewPayslip.employeeName}
              jobRole={viewPayslip.jobRole}
              paygroup={viewPayslip.paygroup}
              accountNumber={viewPayslip.accountNumber}
              bankName={viewPayslip.bankName}
              employeeId={viewPayslip.employeeId}
              currency={currency}
              calc={viewPayslip.calc}
            />
            <PdfDownloadButton
              filename={`payslip-${viewPayslip.periodLabel}`}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-foreground bg-foreground py-2.5 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-60"
            >
              Download PDF
            </PdfDownloadButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
