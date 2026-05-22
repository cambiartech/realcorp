"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PayslipPrintView } from "@/components/hr/payslip-print-view";
import { PayslipYtdCard } from "@/components/hr/payslip-ytd-card";
import type { PayslipYtdSummary } from "@/lib/hr-payslip-ytd";
import { useSnackbar } from "@/components/snackbar";
import type { PayslipCalculation } from "@/lib/hr-payslip";
import type { ProfileDetailRow } from "@/lib/hr-profile-form";
import type { TenantBranding } from "@/lib/tenant-branding";
import { saveSelfAppraisal } from "@/app/[tenantSlug]/hr/actions";

type MyTab = "overview" | "payslips" | "record" | "documents" | "appraisals";

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
}: {
  tenantSlug: string;
  companyName: string;
  tenantBrand: TenantBranding;
  currency: string;
  canManageHr?: boolean;
  myYtd?: PayslipYtdSummary | null;
  previewAs?: { userId: string; name: string; email: string } | null;
  myView: {
    profile: ProfileDetailRow | null;
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
    appraisalActions: Array<{
      id: string;
      title: string;
      description: string;
      cycleType: string;
    }>;
  };
}) {
  const { showSnackbar } = useSnackbar();
  const [tab, setTab] = useState<MyTab>("overview");
  const [recordSection, setRecordSection] = useState<"personal" | "job" | "bank" | "emergency">("personal");
  const [viewPayslipId, setViewPayslipId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const viewPayslip = viewPayslipId ? myView.payslips.find((p) => p.id === viewPayslipId) : null;

  const openAppraisals = myView.appraisals.filter(
    (a) => a.cycleStatus === "OPEN" && a.statusValue !== "REVIEWED",
  );

  const onboarding = myView.onboardingSummary ?? { state: "none" as const };
  const onboardingPending = onboarding.state === "pending";
  const onboardingComplete = onboarding.state === "complete";

  const pendingActionCount =
    (onboardingPending ? onboarding.pendingCount : 0) +
    (myView.pendingOfferSignUrl ? 1 : 0);

  function scrollToActionRequired() {
    requestAnimationFrame(() => {
      document.getElementById("my-hr-action-required")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const tabs: { id: MyTab; label: string; badge?: number }[] = [
    { id: "overview", label: "Overview", badge: pendingActionCount || undefined },
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
    const actionResponses: { actionId: string; rating?: number; completed?: boolean }[] = [];
    for (const [key, val] of fd.entries()) {
      if (key.startsWith("action_rating_")) {
        const actionId = key.replace("action_rating_", "");
        const rating = Number(val);
        if (rating >= 1 && rating <= 5) {
          actionResponses.push({ actionId, rating });
        }
      }
      if (key.startsWith("action_done_") && val === "on") {
        const actionId = key.replace("action_done_", "");
        actionResponses.push({ actionId, completed: true });
      }
    }
    setPending(true);
    const result = await saveSelfAppraisal(tenantSlug, appraisalId, {
      selfNotes: String(fd.get("selfNotes") || ""),
      actionResponses,
    });
    setPending(false);
    if (!result.ok) {
      showSnackbar(result.error || "Could not save.", "error");
      return;
    }
    showSnackbar("Your self-appraisal was submitted.", "success");
  }

  if (!myView.profile) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
        {canManageHr ? (
          <>
            <p className="text-sm font-semibold text-foreground">No personal HR record for this login</p>
            <p className="mt-2 text-sm text-muted">
              You are signed in as HR admin. Use <strong>People</strong> to manage staff. My dashboard is only for team
              members who have an employee record (including you, if you are also on payroll).
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
              Your HR record is being set up. Complete any forms below, or ask HR to finish onboarding from People.
            </p>
          </>
        )}
        {onboardingPending || onboardingComplete || myView.pendingOfferSignUrl ? (
          <div className="mt-4 text-left">
            {onboardingComplete ? (
              <p className="text-sm text-emerald-800">Onboarding forms submitted — HR will review.</p>
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
                  <a href={myView.pendingOfferSignUrl} className="text-sm font-semibold text-foreground underline">
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

  return (
    <div className="space-y-4">
      {previewAs ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <p className="text-sm text-foreground">
            <strong>HR preview</strong> — {previewAs.name}&apos;s dashboard ({previewAs.email}). This is not your login.
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
              tab === t.id ? "bg-foreground text-background" : "text-muted hover:bg-foreground/[0.06] hover:text-foreground",
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
            <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 p-4">
              <p className="text-sm font-semibold text-emerald-900">Onboarding forms complete</p>
              <p className="mt-1 text-sm text-emerald-800">
                You submitted {onboarding.submittedCount} section{onboarding.submittedCount === 1 ? "" : "s"}.
                HR will review your information
                {onboarding.submittedAtLabel !== "—" ? ` (last update ${onboarding.submittedAtLabel})` : ""}.
              </p>
              {onboarding.viewUrl ? (
                <a href={onboarding.viewUrl} className="mt-2 inline-block text-xs font-semibold text-emerald-900 underline">
                  View submitted forms
                </a>
              ) : null}
            </div>
          ) : null}
          {pendingActionCount > 0 ? (
            onboardingPending && onboarding.masterUrl ? (
              <a
                href={onboarding.masterUrl}
                className="block w-full rounded-lg border border-violet-500/40 bg-violet-500/10 p-4 text-left hover:bg-violet-500/15 sm:col-span-2 lg:col-span-4"
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
                className="w-full rounded-lg border border-violet-500/40 bg-violet-500/10 p-4 text-left hover:bg-violet-500/15 sm:col-span-2 lg:col-span-4"
              >
                <p className="text-2xl font-bold text-foreground">{pendingActionCount}</p>
                <p className="text-xs text-muted">Forms or offer waiting for you — tap to view</p>
              </button>
            )
          ) : null}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setTab("payslips")}
            className="rounded-lg border border-foreground/10 p-4 text-left hover:bg-foreground/[0.03]"
          >
            <p className="text-2xl font-bold text-foreground">{myView.payslips.length}</p>
            <p className="text-xs text-muted">Payslips available</p>
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
            <p className="text-2xl font-bold text-foreground">✓</p>
            <p className="text-xs text-muted">View my record</p>
          </button>
        </div>
        </div>
      ) : null}

      {tab === "overview" && (onboardingPending || myView.pendingOfferSignUrl) ? (
        <div id="my-hr-action-required" className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
          <p className="text-sm font-semibold text-foreground">Action required — from HR</p>
          {onboardingPending && onboarding.masterUrl ? (
            <a
              href={onboarding.masterUrl}
              className="mt-3 flex w-full items-center justify-center rounded-md border border-foreground bg-foreground px-4 py-3 text-sm font-semibold text-background"
            >
              Continue onboarding ({onboarding.pendingCount} section{onboarding.pendingCount === 1 ? "" : "s"} left)
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
                      {f.formTypeLabel}{" "}
                      <span className="text-muted">(due {f.expiresLabel})</span>
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

      {tab === "overview" && myYtd ? (
        <PayslipYtdCard ytd={myYtd} currency={currency} />
      ) : null}

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

      {tab === "payslips" ? (
        myView.payslips.length === 0 ? (
          <p className="text-sm text-muted">No finalized payslips yet. They appear here after HR publishes each month.</p>
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
                    Net pay: {currency} {s.calc.netPay.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="mt-1 text-[10px] font-medium">
                    {s.paymentStatusValue === "PAID" ? (
                      <span className="text-emerald-700">Salary paid · {s.paidAtLabel}</span>
                    ) : (
                      <span className="text-amber-800">Payment processing</span>
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
          <p className="mb-3 text-xs text-muted">Read-only view of what HR has on file. Contact HR to request changes.</p>
          <div className="mb-3 flex flex-wrap gap-1">
            {(["personal", "job", "bank", "emergency"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setRecordSection(s)}
                className={[
                  "rounded-md px-2.5 py-1.5 text-xs font-medium capitalize",
                  recordSection === s ? "bg-foreground/10 text-foreground" : "text-muted",
                ].join(" ")}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="rounded-lg border border-foreground/10 px-4">
            {recordSection === "personal" ? (
              <>
                <ReadRow label="Full name" value={p.fullName} />
                <ReadRow label="Mobile" value={p.phoneMobile} />
                <ReadRow label="Work email" value={p.workEmail} />
                <ReadRow label="Address" value={[p.addressStreet, p.addressCity, p.addressState].filter(Boolean).join(", ")} />
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
                <ReadRow label="Account number" value={p.bankAccountNumber ? `•••• ${p.bankAccountNumber.slice(-4)}` : null} />
                <ReadRow label="Account type" value={p.bankAccountType} />
              </>
            ) : null}
            {recordSection === "emergency" ? (
              <>
                <ReadRow label="Emergency contact" value={p.emergencyName} />
                <ReadRow label="Relationship" value={p.emergencyRelationship} />
                <ReadRow label="Phone" value={p.emergencyPhone} />
              </>
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
              const scores = (a.actionScores as Record<string, { rating?: number; completed?: boolean }> | null) ?? {};

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
                    </div>
                    {!canEdit ? (
                      <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-medium uppercase">
                        {a.statusValue === "REVIEWED" ? "Reviewed" : "Submitted"}
                      </span>
                    ) : null}
                  </div>

                  {actions.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Review checklist</p>
                      {actions.map((action) => (
                        <div key={action.id} className="rounded-md border border-foreground/10 bg-foreground/[0.02] p-3">
                          <p className="text-sm font-medium text-foreground">{action.title}</p>
                          {action.description ? <p className="mt-0.5 text-xs text-muted">{action.description}</p> : null}
                          {canEdit ? (
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                              <label className="flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  name={`action_done_${action.id}`}
                                  defaultChecked={Boolean(scores[action.id]?.completed)}
                                />
                                Done
                              </label>
                              <label className="flex items-center gap-2 text-xs">
                                Rating
                                <select
                                  name={`action_rating_${action.id}`}
                                  defaultValue={scores[action.id]?.rating ? String(scores[action.id].rating) : ""}
                                  className="rounded border border-foreground/15 bg-field px-2 py-1 text-xs"
                                >
                                  <option value="">—</option>
                                  {[1, 2, 3, 4, 5].map((n) => (
                                    <option key={n} value={n}>
                                      {n}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          ) : scores[action.id]?.rating ? (
                            <p className="mt-1 text-xs text-muted">Your rating: {scores[action.id].rating}/5</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <label className="mt-4 block text-sm">
                    <span className="mb-1 block text-xs font-medium text-muted">Your comments</span>
                    <textarea
                      name="selfNotes"
                      defaultValue={a.selfNotes}
                      readOnly={!canEdit}
                      rows={4}
                      placeholder="What went well this period? What will you improve?"
                      className={inputClass}
                    />
                  </label>

                  {a.statusValue === "REVIEWED" && a.managerNotes ? (
                    <div className="mt-3 rounded-md bg-foreground/[0.04] p-3 text-sm">
                      <p className="text-xs font-semibold text-muted">Manager feedback</p>
                      <p className="mt-1 whitespace-pre-wrap">{a.managerNotes}</p>
                      {a.overallRating ? (
                        <p className="mt-2 text-xs text-muted">Overall rating: {a.overallRating}/5</p>
                      ) : null}
                    </div>
                  ) : null}

                  {canEdit ? (
                    <button
                      type="submit"
                      disabled={pending}
                      className="mt-3 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
                    >
                      {pending ? "Submitting…" : "Submit self-appraisal"}
                    </button>
                  ) : null}
                </form>
              );
            })}
          </div>
        )
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
            <button
              type="button"
              onClick={() => window.print()}
              className="mt-4 w-full rounded-md border border-foreground bg-foreground py-2.5 text-sm font-semibold text-background"
            >
              Print or save as PDF
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
