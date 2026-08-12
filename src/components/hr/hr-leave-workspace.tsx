"use client";

import {
  adjustLeaveBalance,
  cancelLeaveRequest,
  createLeaveType,
  deleteLeaveHoliday,
  getLeaveUploadSignature,
  requestLeave,
  reviewLeaveRequest,
  saveLeaveHoliday,
} from "@/app/[tenantSlug]/hr/leave-actions";
import { FileDropZone } from "@/components/hr/file-drop-zone";
import { ModalOverlay } from "@/components/modal-overlay";
import { useSnackbar } from "@/components/snackbar";
import { uploadViaCloudinarySignature } from "@/lib/cloudinary-upload-client";
import { MODAL_PANEL_FORM, MODAL_PANEL_XS } from "@/lib/modal-panel";
import { CalendarDays, Check, Clock3, Plus, Settings2, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LeaveRequestRow = {
  id: string;
  employeeName: string;
  department: string;
  leaveTypeName: string;
  dayUnit: string;
  startDate: string;
  endDate: string;
  requestedUnits: number;
  reason: string;
  attachmentUrl: string;
  status: string;
  reviewedByLabel: string;
  reviewNote: string;
  createdAt: string;
};

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

type LeavePolicyRow = {
  id: string;
  name: string;
  code: string;
  countryCode: string;
  department: string;
  dayUnit: string;
  accrualMethod: string;
  annualEntitlement: number;
  paidPercentage: number;
  minimumServiceMonths: number;
  statutoryReference: string;
};

const inputClass =
  "w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20";

function unitLabel(value: string, amount?: number) {
  const label =
    value === "CALENDAR_DAYS" ? "calendar day" : value === "HOURS" ? "hour" : "working day";
  return amount === 1 ? label : `${label}s`;
}

function statusClass(status: string) {
  if (status === "APPROVED") return "bg-[var(--success-wash)] text-[var(--success)]";
  if (status === "REJECTED" || status === "CANCELLED") return "bg-foreground/[0.06] text-muted";
  return "bg-[var(--warn-wash)] text-[var(--warn)]";
}

export function HrLeaveWorkspace({
  tenantSlug,
  canManage,
  hasEmployeeProfile,
  year,
  balances,
  myRequests,
  teamRequests,
  policies,
  holidays,
  employeeOptions,
  pendingTeamCount,
}: {
  tenantSlug: string;
  canManage: boolean;
  hasEmployeeProfile: boolean;
  year: number;
  balances: LeaveBalanceRow[];
  myRequests: LeaveRequestRow[];
  teamRequests: LeaveRequestRow[];
  policies: LeavePolicyRow[];
  holidays: Array<{
    id: string;
    name: string;
    date: string;
    countryCode: string;
    regionCode: string;
  }>;
  employeeOptions: Array<{ id: string; name: string }>;
  pendingTeamCount: number;
}) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [tab, setTab] = useState<"team" | "mine" | "policies">(canManage ? "team" : "mine");
  const [showRequest, setShowRequest] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [showHoliday, setShowHoliday] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<LeaveRequestRow | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<{ profileId?: string; typeId?: string } | null>(null);
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);

  async function finish(result: { ok: boolean; error?: string }, success: string) {
    if (!result.ok) {
      showSnackbar(result.error || "Could not complete the action.", "error");
      return false;
    }
    showSnackbar(success, "success");
    router.refresh();
    return true;
  }

  async function submitRequest(form: HTMLFormElement) {
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
      if (await finish(result, "Leave request sent to HR.")) {
        setShowRequest(false);
        setEvidenceFile(null);
      }
    } finally {
      setPending(false);
    }
  }

  const summary = {
    approved: myRequests.filter((request) => request.status === "APPROVED").length,
    pending: myRequests.filter((request) => request.status === "PENDING").length,
    available: balances.reduce(
      (sum, balance) => sum + (balance.unlimited ? 0 : Math.max(0, balance.available ?? 0)),
      0,
    ),
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">People operations</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Leave tracker</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Request time away, track balances, and keep every HR decision in one auditable workflow.
          </p>
        </div>
        {hasEmployeeProfile ? (
          <button
            type="button"
            onClick={() => setShowRequest(true)}
            className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2.5 text-sm font-semibold text-background"
          >
            <Plus className="h-4 w-4" />
            Request leave
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-foreground/10 p-4">
          <p className="text-xs text-muted">Available in {year}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{summary.available}</p>
          <p className="text-xs text-muted">across limited policies</p>
        </div>
        <div className="rounded-lg border border-foreground/10 p-4">
          <p className="text-xs text-muted">My pending requests</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{summary.pending}</p>
        </div>
        <div className="rounded-lg border border-foreground/10 p-4">
          <p className="text-xs text-muted">My approved requests</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{summary.approved}</p>
        </div>
        {canManage ? (
          <div className="rounded-lg border border-[var(--warn-line)] bg-[var(--warn-wash)] p-4">
            <p className="text-xs text-muted">Awaiting HR review</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{pendingTeamCount}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-foreground/10 p-4">
            <CalendarDays className="h-5 w-5 text-muted" />
            <p className="mt-2 text-xs text-muted">Weekends and configured public holidays are excluded.</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-foreground/10 pb-1">
        {[
          ...(canManage ? ([{ id: "team", label: `Team requests (${pendingTeamCount})` }] as const) : []),
          { id: "mine", label: "My leave" } as const,
          ...(canManage ? ([{ id: "policies", label: "Policies & balances" }] as const) : []),
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={[
              "rounded-md px-3 py-2 text-sm font-medium",
              tab === item.id ? "bg-foreground text-background" : "text-muted hover:bg-foreground/[0.06]",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "team" && canManage ? (
        <RequestTable
          rows={teamRequests}
          empty="No team leave requests on this page."
          actions={(request) =>
            request.status === "PENDING" ? (
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={pending}
                  onClick={async () => {
                    setPending(true);
                    try {
                      await finish(
                        await reviewLeaveRequest(tenantSlug, {
                          requestId: request.id,
                          decision: "APPROVED",
                        }),
                        "Leave approved.",
                      );
                    } finally {
                      setPending(false);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-md bg-[var(--success)] px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" /> Approve
                </button>
                <button
                  type="button"
                  onClick={() => setReviewTarget(request)}
                  className="inline-flex items-center gap-1 rounded-md border border-foreground/15 px-2.5 py-1.5 text-xs font-semibold"
                >
                  <X className="h-3.5 w-3.5" /> Decline
                </button>
              </div>
            ) : null
          }
        />
      ) : null}

      {tab === "mine" ? (
        <div className="space-y-4">
          {balances.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {balances.map((balance) => (
                <article key={balance.leaveTypeId} className="rounded-lg border border-foreground/10 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">{balance.name}</h2>
                      <p className="mt-0.5 text-xs text-muted">{unitLabel(balance.dayUnit)}</p>
                    </div>
                    <p className="text-xl font-bold text-foreground">
                      {balance.unlimited ? "∞" : balance.available}
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-foreground/10 pt-3 text-xs">
                    <div><p className="text-muted">Earned</p><p className="font-semibold">{balance.unlimited ? "∞" : balance.accrued}</p></div>
                    <div><p className="text-muted">Approved</p><p className="font-semibold">{balance.approved}</p></div>
                    <div><p className="text-muted">Reserved</p><p className="font-semibold">{balance.pending}</p></div>
                  </div>
                  {balance.statutoryReference ? (
                    <p className="mt-3 text-[11px] leading-4 text-muted">{balance.statutoryReference}</p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-foreground/20 p-8 text-center text-sm text-muted">
              HR has not configured a leave policy for your location yet.
            </div>
          )}
          <RequestTable
            rows={myRequests}
            empty="You have not requested leave yet."
            actions={(request) =>
              request.status === "PENDING" ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={async () => {
                    setPending(true);
                    try {
                      await finish(await cancelLeaveRequest(tenantSlug, request.id), "Leave request cancelled.");
                    } finally {
                      setPending(false);
                    }
                  }}
                  className="rounded-md border border-foreground/15 px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
              ) : null
            }
          />
        </div>
      ) : null}

      {tab === "policies" && canManage ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Leave policies</h2>
              <p className="text-xs text-muted">Jurisdiction and department rules remain configurable.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAdjustTarget({})} className="rounded-md border border-foreground/15 px-3 py-2 text-xs font-semibold">
                Adjust balance
              </button>
              <button type="button" onClick={() => setShowPolicy(true)} className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-xs font-semibold text-background">
                <Settings2 className="h-3.5 w-3.5" /> New policy
              </button>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-foreground/10">
            <div className="divide-y divide-foreground/10">
              {policies.map((policy) => (
                <div key={policy.id} className="grid gap-3 px-4 py-3 md:grid-cols-[1.2fr_.7fr_.7fr_1.5fr] md:items-center">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{policy.name}</p>
                    <p className="text-xs text-muted">{policy.code} · {policy.countryCode || "All countries"}</p>
                  </div>
                  <p className="text-xs text-muted">{policy.annualEntitlement} {unitLabel(policy.dayUnit, policy.annualEntitlement)} / year</p>
                  <p className="text-xs text-muted">{policy.paidPercentage}% paid · {policy.accrualMethod.toLowerCase().replace("_", " ")}</p>
                  <p className="text-xs text-muted">{policy.statutoryReference || "Organization policy"}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-foreground/10">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/10 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Public holiday calendar</h2>
                <p className="text-xs text-muted">Matching holidays are excluded from working-day requests.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowHoliday(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-foreground/15 px-3 py-2 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" /> Add holiday
              </button>
            </div>
            {holidays.length ? (
              <div className="divide-y divide-foreground/10">
                {holidays.map((holiday) => (
                  <div key={holiday.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{holiday.name}</p>
                      <p className="text-xs text-muted">
                        {holiday.date} · {holiday.countryCode || "All countries"}
                        {holiday.regionCode ? ` / ${holiday.regionCode}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${holiday.name}`}
                      disabled={pending}
                      onClick={async () => {
                        setPending(true);
                        try {
                          await finish(
                            await deleteLeaveHoliday(tenantSlug, holiday.id),
                            "Holiday removed.",
                          );
                        } finally {
                          setPending(false);
                        }
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:text-[var(--danger)] disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="px-4 py-6 text-center text-sm text-muted">No holidays configured for {year}.</p>
            )}
          </div>
        </div>
      ) : null}

      <ModalOverlay open={showRequest} onClose={() => !pending && setShowRequest(false)} panelClassName={MODAL_PANEL_FORM} aria-labelledby="leave-request-title">
        <form onSubmit={(event) => { event.preventDefault(); void submitRequest(event.currentTarget); }}>
          <div className="border-b border-foreground/10 px-5 py-4">
            <h2 id="leave-request-title" className="text-lg font-semibold text-foreground">Request leave</h2>
            <p className="text-sm text-muted">HR will review your dates, balance, and supporting evidence.</p>
          </div>
          <div className="grid gap-4 p-5">
            <label className="text-sm"><span className="mb-1 block text-xs font-medium">Leave type</span>
              <select name="leaveTypeId" required className={inputClass}><option value="">Select policy</option>{balances.map((balance) => <option key={balance.leaveTypeId} value={balance.leaveTypeId}>{balance.name} ({balance.unlimited ? "unlimited" : `${balance.available} available`})</option>)}</select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm"><span className="mb-1 block text-xs font-medium">Start date</span><input type="date" name="startDate" required className={inputClass} /></label>
              <label className="text-sm"><span className="mb-1 block text-xs font-medium">End date</span><input type="date" name="endDate" required className={inputClass} /></label>
            </div>
            {balances.some((balance) => balance.dayUnit === "HOURS") ? (
              <label className="text-sm"><span className="mb-1 block text-xs font-medium">Hours (hourly policies only)</span><input type="number" min="0.25" step="0.25" name="requestedHours" className={inputClass} /></label>
            ) : null}
            <label className="text-sm"><span className="mb-1 block text-xs font-medium">Reason</span><textarea name="reason" rows={3} className={inputClass} placeholder="Add context for your approver" /></label>
            <div>
              <p className="mb-2 text-xs font-medium">Supporting evidence (if required)</p>
              <FileDropZone onFile={setEvidenceFile} uploading={pending} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" hint={evidenceFile ? evidenceFile.name : "PDF, image, or Word document"} />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-foreground/10 px-5 py-4">
            <button type="button" disabled={pending} onClick={() => setShowRequest(false)} className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-semibold">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">{pending ? "Submitting…" : "Send request"}</button>
          </div>
        </form>
      </ModalOverlay>

      <ModalOverlay open={Boolean(reviewTarget)} onClose={() => !pending && setReviewTarget(null)} panelClassName={MODAL_PANEL_XS} aria-labelledby="decline-leave-title">
        <form onSubmit={async (event) => {
          event.preventDefault();
          if (!reviewTarget) return;
          setPending(true);
          try {
            const note = String(new FormData(event.currentTarget).get("note") || "");
            if (await finish(await reviewLeaveRequest(tenantSlug, { requestId: reviewTarget.id, decision: "REJECTED", note }), "Leave request declined.")) setReviewTarget(null);
          } finally { setPending(false); }
        }}>
          <div className="border-b border-foreground/10 px-5 py-4"><h2 id="decline-leave-title" className="text-lg font-semibold">Decline request?</h2><p className="text-sm text-muted">Give {reviewTarget?.employeeName} a clear reason.</p></div>
          <div className="p-5"><textarea name="note" required rows={4} className={inputClass} placeholder="Reason for declining" /></div>
          <div className="flex justify-end gap-2 border-t border-foreground/10 px-5 py-4"><button type="button" onClick={() => setReviewTarget(null)} className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-semibold">Keep pending</button><button type="submit" disabled={pending} className="rounded-md bg-[var(--danger)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Declining…" : "Decline"}</button></div>
        </form>
      </ModalOverlay>

      <ModalOverlay open={showPolicy} onClose={() => !pending && setShowPolicy(false)} panelClassName={MODAL_PANEL_FORM} aria-labelledby="leave-policy-title">
        <form onSubmit={async (event) => {
          event.preventDefault();
          const data = Object.fromEntries(new FormData(event.currentTarget));
          setPending(true);
          try {
            if (await finish(await createLeaveType(tenantSlug, data), "Leave policy created.")) setShowPolicy(false);
          } finally { setPending(false); }
        }}>
          <div className="border-b border-foreground/10 px-5 py-4"><h2 id="leave-policy-title" className="text-lg font-semibold">Create leave policy</h2><p className="text-sm text-muted">Set a local rule without changing policies for other countries.</p></div>
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <label className="text-sm"><span className="mb-1 block text-xs font-medium">Policy name</span><input name="name" required className={inputClass} /></label>
            <label className="text-sm"><span className="mb-1 block text-xs font-medium">Code</span><input name="code" required className={inputClass} placeholder="ANNUAL_UK" /></label>
            <label className="text-sm"><span className="mb-1 block text-xs font-medium">Country code</span><input name="countryCode" maxLength={2} className={inputClass} placeholder="Blank = global" /></label>
            <label className="text-sm"><span className="mb-1 block text-xs font-medium">Department</span><input name="department" className={inputClass} placeholder="Blank = everyone" /></label>
            <label className="text-sm"><span className="mb-1 block text-xs font-medium">Unit</span><select name="dayUnit" className={inputClass}><option value="WORKING_DAYS">Working days</option><option value="CALENDAR_DAYS">Calendar days</option><option value="HOURS">Hours</option></select></label>
            <label className="text-sm"><span className="mb-1 block text-xs font-medium">Accrual</span><select name="accrualMethod" className={inputClass}><option value="ANNUAL_GRANT">Annual grant</option><option value="MONTHLY">Monthly</option><option value="NONE">No accrual</option></select></label>
            <label className="text-sm"><span className="mb-1 block text-xs font-medium">Annual entitlement</span><input type="number" min="0" step="0.25" name="annualEntitlement" defaultValue="20" required className={inputClass} /></label>
            <label className="text-sm"><span className="mb-1 block text-xs font-medium">Paid percentage</span><input type="number" min="0" max="100" step="0.01" name="paidPercentage" defaultValue="100" required className={inputClass} /></label>
            <label className="text-sm"><span className="mb-1 block text-xs font-medium">Waiting period (months)</span><input type="number" min="0" name="minimumServiceMonths" defaultValue="0" required className={inputClass} /></label>
            <label className="text-sm"><span className="mb-1 block text-xs font-medium">Evidence required after units</span><input type="number" min="0" step="0.25" name="requiresDocumentAfterUnits" className={inputClass} placeholder="Optional" /></label>
            <label className="text-sm sm:col-span-2"><span className="mb-1 block text-xs font-medium">Legal or policy reference</span><textarea name="statutoryReference" rows={2} className={inputClass} /></label>
            <div className="flex flex-wrap gap-4 text-xs sm:col-span-2">
              <label className="flex items-center gap-2"><input type="checkbox" name="carryoverEnabled" value="true" /> Allow carryover</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="allowNegativeBalance" value="true" /> Allow negative balance</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="unlimited" value="true" /> Unlimited</label>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-foreground/10 px-5 py-4"><button type="button" onClick={() => setShowPolicy(false)} className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-semibold">Cancel</button><button type="submit" disabled={pending} className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">{pending ? "Creating…" : "Create policy"}</button></div>
        </form>
      </ModalOverlay>

      <ModalOverlay open={Boolean(adjustTarget)} onClose={() => !pending && setAdjustTarget(null)} panelClassName={MODAL_PANEL_XS} aria-labelledby="adjust-leave-title">
        <form onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setPending(true);
          try {
            if (await finish(await adjustLeaveBalance(tenantSlug, {
              employeeProfileId: String(data.get("employeeProfileId") || ""),
              leaveTypeId: String(data.get("leaveTypeId") || ""),
              year: Number(data.get("year")),
              adjustmentUnits: Number(data.get("adjustmentUnits")),
              reason: String(data.get("reason") || ""),
            }), "Leave balance adjusted.")) setAdjustTarget(null);
          } finally { setPending(false); }
        }}>
          <div className="border-b border-foreground/10 px-5 py-4"><h2 id="adjust-leave-title" className="text-lg font-semibold">Adjust leave balance</h2><p className="text-sm text-muted">Manual changes are recorded in the audit log.</p></div>
          <div className="grid gap-3 p-5">
            <label className="text-sm"><span className="mb-1 block text-xs font-medium">Employee</span><select name="employeeProfileId" required className={inputClass}><option value="">Select employee</option>{employeeOptions.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>
            <label className="text-sm"><span className="mb-1 block text-xs font-medium">Leave policy</span><select name="leaveTypeId" required className={inputClass}><option value="">Select policy</option>{policies.map((policy) => <option key={policy.id} value={policy.id}>{policy.name}</option>)}</select></label>
            <div className="grid grid-cols-2 gap-3"><label className="text-sm"><span className="mb-1 block text-xs font-medium">Year</span><input type="number" name="year" defaultValue={year} required className={inputClass} /></label><label className="text-sm"><span className="mb-1 block text-xs font-medium">Adjustment</span><input type="number" name="adjustmentUnits" step="0.25" required className={inputClass} /></label></div>
            <label className="text-sm"><span className="mb-1 block text-xs font-medium">Reason</span><textarea name="reason" rows={3} required className={inputClass} /></label>
          </div>
          <div className="flex justify-end gap-2 border-t border-foreground/10 px-5 py-4"><button type="button" onClick={() => setAdjustTarget(null)} className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-semibold">Cancel</button><button type="submit" disabled={pending} className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">{pending ? "Saving…" : "Save adjustment"}</button></div>
        </form>
      </ModalOverlay>

      <ModalOverlay open={showHoliday} onClose={() => !pending && setShowHoliday(false)} panelClassName={MODAL_PANEL_XS} aria-labelledby="holiday-title">
        <form onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setPending(true);
          try {
            if (await finish(await saveLeaveHoliday(tenantSlug, {
              date: String(data.get("date") || ""),
              name: String(data.get("name") || ""),
              countryCode: String(data.get("countryCode") || ""),
              regionCode: String(data.get("regionCode") || ""),
            }), "Holiday added.")) setShowHoliday(false);
          } finally { setPending(false); }
        }}>
          <div className="border-b border-foreground/10 px-5 py-4"><h2 id="holiday-title" className="text-lg font-semibold">Add public holiday</h2><p className="text-sm text-muted">Leave calculations will exclude this date where the location matches.</p></div>
          <div className="grid gap-3 p-5">
            <label className="text-sm"><span className="mb-1 block text-xs font-medium">Holiday name</span><input name="name" required className={inputClass} /></label>
            <label className="text-sm"><span className="mb-1 block text-xs font-medium">Date</span><input type="date" name="date" required className={inputClass} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm"><span className="mb-1 block text-xs font-medium">Country code</span><input name="countryCode" maxLength={2} className={inputClass} placeholder="Blank = global" /></label>
              <label className="text-sm"><span className="mb-1 block text-xs font-medium">Region code</span><input name="regionCode" className={inputClass} placeholder="Optional" /></label>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-foreground/10 px-5 py-4"><button type="button" onClick={() => setShowHoliday(false)} className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-semibold">Cancel</button><button type="submit" disabled={pending} className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">{pending ? "Adding…" : "Add holiday"}</button></div>
        </form>
      </ModalOverlay>
    </div>
  );
}

function RequestTable({
  rows,
  empty,
  actions,
}: {
  rows: LeaveRequestRow[];
  empty: string;
  actions: (request: LeaveRequestRow) => React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-foreground/10">
      {rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted">{empty}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-foreground/[0.03] text-xs text-muted"><tr><th className="px-4 py-3">Employee</th><th className="px-4 py-3">Leave</th><th className="px-4 py-3">Dates</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3 text-right">Action</th></tr></thead>
            <tbody className="divide-y divide-foreground/10">
              {rows.map((request) => (
                <tr key={request.id}>
                  <td className="px-4 py-3"><p className="font-medium text-foreground">{request.employeeName}</p><p className="text-xs text-muted">{request.department || "No department"}</p></td>
                  <td className="px-4 py-3"><p>{request.leaveTypeName}</p><p className="text-xs text-muted">{request.requestedUnits} {unitLabel(request.dayUnit, request.requestedUnits)}</p></td>
                  <td className="px-4 py-3"><p>{request.startDate}</p><p className="text-xs text-muted">to {request.endDate}</p></td>
                  <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${statusClass(request.status)}`}>{request.status === "PENDING" ? <Clock3 className="h-3 w-3" /> : null}{request.status}</span>{request.reviewedByLabel ? <p className="mt-1 text-[11px] text-muted">by {request.reviewedByLabel}</p> : null}</td>
                  <td className="max-w-[220px] px-4 py-3"><p className="line-clamp-2 text-xs text-muted">{request.reason || "No reason supplied"}</p>{request.attachmentUrl ? <a href={request.attachmentUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold underline">View evidence</a> : null}{request.reviewNote ? <p className="mt-1 text-[11px] text-muted">HR: {request.reviewNote}</p> : null}</td>
                  <td className="px-4 py-3 text-right">{actions(request)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
