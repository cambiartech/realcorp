"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Banknote,
  Calendar,
  CheckCircle2,
  CircleDashed,
  FileText,
  Layers,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { ModalOverlay } from "@/components/modal-overlay";
import { PdfDownloadButton } from "@/components/pdf-download-button";
import { PayrollWorkflowGuide } from "@/components/hr/payroll-workflow-guide";
import { PayslipPrintView } from "@/components/hr/payslip-print-view";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import type { PayslipCalculation } from "@/lib/hr-payslip";
import type { TenantBranding } from "@/lib/tenant-branding";
import {
  finalizeAllDraftPayslipRuns,
  finalizePayslipRun,
  generatePayslipRun,
  markPayslipPayments,
  deletePayrollAdjustment,
  savePayrollAdjustment,
} from "@/app/[tenantSlug]/hr/actions";
import { MODAL_PANEL_FORM } from "@/lib/modal-panel";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export type PayslipRunView = {
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
};

function paygroupKey(paygroup: string) {
  const t = paygroup?.trim();
  return t ? t : "__UNASSIGNED__";
}

function paygroupLabel(key: string) {
  return key === "__UNASSIGNED__" ? "Unassigned" : key;
}

export function HrPayslipsWorkspace({
  tenantSlug,
  companyName,
  tenantBrand,
  currency,
  payslipRuns,
  payrollReadyCount,
  missingGrossCount,
  paygroups,
  payrollReadyByPaygroup,
  unassignedPayrollCount,
  draftPayslipRunCount,
}: {
  tenantSlug: string;
  companyName: string;
  tenantBrand: TenantBranding;
  currency: string;
  payslipRuns: PayslipRunView[];
  payrollReadyCount: number;
  missingGrossCount: number;
  paygroups: string[];
  payrollReadyByPaygroup: Array<{ name: string; count: number }>;
  unassignedPayrollCount: number;
  draftPayslipRunCount: number;
}) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [generatePaygroup, setGeneratePaygroup] = useState("ALL");
  const [filterPaygroup, setFilterPaygroup] = useState("ALL");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(payslipRuns[0]?.id ?? null);
  const [viewPayslipId, setViewPayslipId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [paymentRef, setPaymentRef] = useState("");
  const [pending, setPending] = useState(false);
  const [adjustmentTargetId, setAdjustmentTargetId] = useState<string | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<"EARNING" | "DEDUCTION">("EARNING");

  const selectedRun = useMemo(
    () => payslipRuns.find((r) => r.id === selectedRunId) ?? payslipRuns[0] ?? null,
    [payslipRuns, selectedRunId],
  );

  const filteredPayslips = useMemo(() => {
    if (!selectedRun) return [];
    if (filterPaygroup === "ALL") return selectedRun.payslips;
    return selectedRun.payslips.filter((p) => paygroupKey(p.paygroup) === filterPaygroup);
  }, [selectedRun, filterPaygroup]);

  const runTotals = useMemo(() => {
    return filteredPayslips.reduce(
      (acc, p) => ({
        gross: acc.gross + p.grossPay,
        payee: acc.payee + p.calc.payeeTax,
        pension: acc.pension + p.calc.pensionDeduction,
        net: acc.net + p.netPay,
      }),
      { gross: 0, payee: 0, pension: 0, net: 0 },
    );
  }, [filteredPayslips]);

  const viewPayslip = viewPayslipId ? filteredPayslips.find((p) => p.id === viewPayslipId) : null;
  const adjustmentTarget =
    adjustmentTargetId && selectedRun
      ? selectedRun.payslips.find((p) => p.id === adjustmentTargetId) ?? null
      : null;
  const targetAdjustments =
    adjustmentTarget && selectedRun
      ? selectedRun.adjustments.filter(
          (adjustment) => adjustment.employeeProfileId === adjustmentTarget.employeeProfileId,
        )
      : [];

  const generatePeriodRun = useMemo(
    () => payslipRuns.find((r) => r.year === year && r.month === month) ?? null,
    [payslipRuns, year, month],
  );

  const runPaymentStats = useMemo(() => {
    if (!selectedRun) return { paid: 0, pending: 0, total: 0 };
    const total = selectedRun.payslips.length;
    const paid = selectedRun.payslips.filter((p) => p.paymentStatusValue === "PAID").length;
    return { paid, pending: total - paid, total };
  }, [selectedRun]);

  const filteredPaymentStats = useMemo(() => {
    const paid = filteredPayslips.filter((p) => p.paymentStatusValue === "PAID").length;
    return { paid, pending: filteredPayslips.length - paid, total: filteredPayslips.length };
  }, [filteredPayslips]);

  const periodStatus: "none" | "DRAFT" | "FINALIZED" = generatePeriodRun
    ? (generatePeriodRun.statusValue as "DRAFT" | "FINALIZED")
    : "none";

  const periodPaidCount = generatePeriodRun
    ? generatePeriodRun.payslips.filter((p) => p.paymentStatusValue === "PAID").length
    : 0;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(filteredPayslips.map((p) => p.id)));
  }

  async function runAction(
    fn: () => Promise<{ ok: boolean; error?: string; count?: number }>,
    success: string | ((count?: number) => string),
  ) {
    setPending(true);
    try {
      const result = await fn();
      if (!result.ok) {
        showSnackbar(result.error || "Something went wrong.", "error");
        return false;
      }
      const msg = typeof success === "function" ? success(result.count) : success;
      showSnackbar(msg, "success");
      setSelectedIds(new Set());
      router.refresh();
      return true;
    } catch (error) {
      showSnackbar(error instanceof Error ? error.message : "The payroll action failed.", "error");
      return false;
    } finally {
      setPending(false);
    }
  }

  async function markPayments(payslipIds: string[], status: "PAID" | "PENDING") {
    if (payslipIds.length === 0) {
      showSnackbar("Select at least one payslip.", "error");
      return;
    }
    await runAction(
      () =>
        markPayslipPayments(tenantSlug, {
          payslipIds,
          paymentStatus: status,
          paymentReference: status === "PAID" ? paymentRef : undefined,
        }),
      (n) =>
        status === "PAID"
          ? `Marked ${n ?? payslipIds.length} salary payment${(n ?? payslipIds.length) === 1 ? "" : "s"} as paid.`
          : `Reset ${n ?? payslipIds.length} to pending payment.`,
    );
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const generatePaygroupParam =
    generatePaygroup === "ALL"
      ? undefined
      : generatePaygroup === "__UNASSIGNED__"
        ? "__UNASSIGNED__"
        : generatePaygroup;

  return (
    <div className="space-y-5">
      <PayrollWorkflowGuide
        tenantSlug={tenantSlug}
        payrollReadyCount={payrollReadyCount}
        periodLabel={`${MONTHS[month - 1]} ${year}`}
        periodSlipCount={generatePeriodRun?.payslipCount ?? 0}
        periodStatus={periodStatus}
        periodPaidCount={periodPaidCount}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
          <p className="text-xs font-medium text-muted">Eligible for payroll</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{payrollReadyCount}</p>
          <p className="text-[11px] text-muted">ACTIVE + gross on People → Job</p>
          {payrollReadyCount === 0 ? (
            <Link href={`/${tenantSlug}/hr/people`} className="mt-1 text-[11px] font-semibold underline">
              Set up employees
            </Link>
          ) : null}
        </div>
        <div className="rounded-lg border border-[var(--accent-line)] bg-[var(--accent-wash)] p-4">
          <p className="text-xs font-medium text-muted">
            {MONTHS[month - 1]} {year}
          </p>
          <p className="mt-1 text-2xl font-bold text-[var(--accent)]">
            {generatePeriodRun ? generatePeriodRun.payslipCount : "—"}
          </p>
          <p className="text-[11px] text-muted">
            {generatePeriodRun
              ? generatePeriodRun.statusValue === "DRAFT"
                ? "Draft — not visible to staff"
                : `Published · ${periodPaidCount} paid`
              : "Not generated — click Generate"}
          </p>
        </div>
        <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
          <p className="text-xs font-medium text-muted">Missing gross</p>
          <p className="mt-1 text-2xl font-bold text-[var(--warn)]">{missingGrossCount}</p>
          <p className="text-[11px] text-muted">People → Job tab</p>
        </div>
        <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
          <p className="text-xs font-medium text-muted">Draft runs</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{draftPayslipRunCount}</p>
          {draftPayslipRunCount > 0 ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                void runAction(
                  async () => {
                    const r = await finalizeAllDraftPayslipRuns(tenantSlug);
                    return r;
                  },
                  `Published ${draftPayslipRunCount} draft payroll run${draftPayslipRunCount === 1 ? "" : "s"}.`,
                )
              }
              className="mt-1 text-[11px] font-semibold text-[var(--success)] underline disabled:opacity-50"
            >
              Publish all drafts
            </button>
          ) : (
            <p className="text-[11px] text-muted">All runs published</p>
          )}
        </div>
        <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
          <p className="flex items-center gap-1 text-xs font-medium text-muted">
            <Layers className="h-3.5 w-3.5" />
            Pay groups
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">{paygroups.length}</p>
          <p className="text-[11px] text-muted">
            {unassignedPayrollCount > 0 ? `${unassignedPayrollCount} unassigned` : "All assigned"}
          </p>
        </div>
      </div>

      {payrollReadyByPaygroup.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {payrollReadyByPaygroup.map((g) => (
            <span
              key={g.name}
              className="rounded-full border border-foreground/10 bg-background px-2.5 py-1 text-[11px] font-medium text-foreground"
            >
              {g.name}: {g.count}
            </span>
          ))}
          {unassignedPayrollCount > 0 ? (
            <span className="rounded-full border border-[var(--warn-line)] bg-[var(--warn-wash)] px-2.5 py-1 text-[11px] text-[var(--warn)]">
              Unassigned: {unassignedPayrollCount}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Calendar className="h-4 w-4" />
              Generate monthly payslips
            </h2>
            <p className="mt-1 text-xs text-muted">
              PAYE follows the organization tax law on{" "}
              <Link href={`/${tenantSlug}/hr/settings`} className="font-semibold underline">
                People → Settings
              </Link>{" "}
              (Nigeria Tax Act 2026: first ₦800,000 a year is untaxed; payslips annualize earnings then
              deduct PAYE monthly). Pension is 8% of basic + housing + transport. Change a single person
              only for a documented exception. After you publish, file statutory remittances from{" "}
              <Link href={`/${tenantSlug}/hr/remittances`} className="font-semibold underline">
                Remittances
              </Link>
              .
            </p>
          </div>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void runAction(
                () =>
                  generatePayslipRun(tenantSlug, {
                    year,
                    month,
                    paygroupName: generatePaygroupParam,
                  }),
                (n) =>
                  n && n > 0
                    ? `Created/updated ${n} payslip${n === 1 ? "" : "s"} for ${MONTHS[month - 1]} ${year}. Publish when ready.`
                    : `No payslips created — check that ${payrollReadyCount} eligible employee${payrollReadyCount === 1 ? "" : "s"} match the pay group filter.`,
              );
            }}
          >
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted">
                Pay group
              </label>
              <UiSelect
                value={generatePaygroup}
                onChange={(e) => setGeneratePaygroup(e.target.value)}
                className="min-w-[120px]"
              >
                <option value="ALL">All groups</option>
                {paygroups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
                {unassignedPayrollCount > 0 ? <option value="__UNASSIGNED__">Unassigned</option> : null}
              </UiSelect>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted">
                Month
              </label>
              <UiSelect
                value={String(month)}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="min-w-[130px]"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </UiSelect>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-muted">
                Year
              </label>
              <UiSelect
                value={String(year)}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-24"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </UiSelect>
            </div>
            <button
              type="submit"
              disabled={pending || payrollReadyCount === 0}
              className="inline-flex items-center gap-1.5 rounded-md border border-foreground bg-foreground px-4 py-2 text-xs font-semibold text-background disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
              Generate / refresh
            </button>
          </form>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-56">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">Payroll periods</p>
          <ul className="space-y-1">
            {payslipRuns.length === 0 ? (
              <li className="rounded-md border border-dashed border-foreground/15 px-3 py-4 text-center text-xs text-muted">
                No runs yet.
              </li>
            ) : (
              payslipRuns.map((run) => (
                <li key={run.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRunId(run.id);
                      setViewPayslipId(null);
                    }}
                    className={[
                      "flex w-full flex-col rounded-md border px-3 py-2 text-left text-sm transition",
                      selectedRun?.id === run.id
                        ? "border-foreground/25 bg-foreground/[0.06] font-semibold"
                        : "border-foreground/10 hover:bg-foreground/[0.03]",
                    ].join(" ")}
                  >
                    <span>{run.label}</span>
                    <span className="text-[10px] text-muted">
                      {run.payslipCount} slips · {run.status}
                      {run.statusValue === "FINALIZED" && run.payslipCount > 0
                        ? ` · ${run.payslips.filter((p) => p.paymentStatusValue === "PAID").length} paid`
                        : ""}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        <div className="min-w-0 flex-1 rounded-xl border border-foreground/10">
          {selectedRun ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/10 px-4 py-3">
                <div>
                  <p className="font-semibold text-foreground">{selectedRun.label}</p>
                  <p className="text-xs text-muted">
                    {filteredPayslips.length} shown · {selectedRun.status}
                    {selectedRun.statusValue === "FINALIZED" && runPaymentStats.total > 0
                      ? ` · ${runPaymentStats.paid} paid · ${runPaymentStats.pending} awaiting bank transfer`
                      : selectedRun.statusValue === "DRAFT"
                        ? " · employees cannot see drafts"
                        : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <UiSelect
                    value={filterPaygroup}
                    onChange={(e) => setFilterPaygroup(e.target.value)}
                    className="min-w-[120px] text-xs"
                  >
                    <option value="ALL">All groups</option>
                    {paygroups.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                    <option value="__UNASSIGNED__">Unassigned</option>
                  </UiSelect>
                  {selectedRun.statusValue === "DRAFT" ? (
                    <button
                      type="button"
                      disabled={pending || selectedRun.payslipCount === 0}
                      onClick={() =>
                        void runAction(
                          () => finalizePayslipRun(tenantSlug, selectedRun.id),
                          "Payslips published — employees can view in My HR. Mark Paid after bank transfer.",
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--success-line)] bg-[var(--success)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Publish month
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--success)]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Published
                    </span>
                  )}
                </div>
              </div>

              {selectedRun.statusValue === "FINALIZED" && filteredPayslips.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 border-b border-foreground/10 bg-foreground/[0.02] px-4 py-2.5">
                  <input
                    type="text"
                    placeholder="Bank ref (optional)"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    className="min-w-[140px] rounded-md border border-foreground/15 bg-field px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void markPayments(Array.from(selectedIds), "PAID")}
                    className="inline-flex items-center gap-1 rounded-md border border-foreground/20 px-2.5 py-1 text-xs font-semibold hover:bg-foreground/[0.06] disabled:opacity-50"
                  >
                    <Banknote className="h-3 w-3" />
                    Mark selected paid
                  </button>
                  <button
                    type="button"
                    disabled={pending || filteredPaymentStats.pending === 0}
                    onClick={() =>
                      void markPayments(
                        filteredPayslips.filter((p) => p.paymentStatusValue !== "PAID").map((p) => p.id),
                        "PAID",
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--success-line)] bg-[var(--success-wash)] px-2.5 py-1 text-xs font-semibold text-[var(--success)] disabled:opacity-50"
                  >
                    Mark all {filteredPaymentStats.pending} pending paid
                  </button>
                  <button type="button" onClick={selectAllVisible} className="text-xs text-muted underline">
                    Select all shown
                  </button>
                </div>
              ) : null}

              {filteredPayslips.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-muted">
                  {selectedRun.payslipCount === 0 ? (
                    <>
                      <p>No payslips in this period.</p>
                      <p className="mt-2">
                        {payrollReadyCount > 0 ? (
                          <>
                            You have {payrollReadyCount} eligible employee{payrollReadyCount === 1 ? "" : "s"}{" "}
                            — use <strong>Generate / refresh</strong> for {selectedRun.label}.
                          </>
                        ) : (
                          <>
                            <Link href={`/${tenantSlug}/hr/people`} className="font-semibold underline">
                              Add gross pay
                            </Link>{" "}
                            on active profiles first.
                          </>
                        )}
                      </p>
                    </>
                  ) : (
                    <p>No payslips for this pay group filter.</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-foreground/10 bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
                          {selectedRun.statusValue === "FINALIZED" ? (
                            <th className="w-8 px-2 py-2.5" />
                          ) : null}
                          <th className="px-4 py-2.5 font-semibold">Employee</th>
                          <th className="px-4 py-2.5 font-semibold">Pay group</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Gross</th>
                          <th className="px-4 py-2.5 font-semibold text-right">PAYE</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Pension</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Net</th>
                          <th className="px-4 py-2.5 font-semibold">Payment</th>
                          <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPayslips.map((p) => (
                          <tr
                            key={p.id}
                            className="border-b border-foreground/10 last:border-0 hover:bg-foreground/[0.02]"
                          >
                            {selectedRun.statusValue === "FINALIZED" ? (
                              <td className="px-2 py-3">
                                <input
                                  type="checkbox"
                                  checked={selectedIds.has(p.id)}
                                  onChange={() => toggleSelect(p.id)}
                                  aria-label={`Select ${p.employeeName}`}
                                />
                              </td>
                            ) : null}
                            <td className="px-4 py-3">
                              <p className="font-medium text-foreground">{p.employeeName}</p>
                              <p className="text-xs text-muted">{p.jobRole || "—"}</p>
                              {selectedRun.adjustments.some(
                                (adjustment) => adjustment.employeeProfileId === p.employeeProfileId,
                              ) ? (
                                <p className="mt-0.5 text-[10px] font-medium text-[var(--info)]">
                                  {
                                    selectedRun.adjustments.filter(
                                      (adjustment) => adjustment.employeeProfileId === p.employeeProfileId,
                                    ).length
                                  }{" "}
                                  monthly adjustment(s)
                                </p>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-muted">{p.paygroup || "—"}</td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {currency} {p.grossPay.toLocaleString("en-NG")}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-muted">
                              {currency} {p.calc.payeeTax.toLocaleString("en-NG")}
                              {p.calc.taxOverrideApplied ? (
                                <p className="text-[10px] font-medium text-[var(--warn)]">Manual PAYE</p>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-muted">
                              {currency} {p.calc.pensionDeduction.toLocaleString("en-NG")}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold tabular-nums">
                              {currency} {p.netPay.toLocaleString("en-NG")}
                            </td>
                            <td className="px-4 py-3">
                              {selectedRun.statusValue === "FINALIZED" ? (
                                p.paymentStatusValue === "PAID" ? (
                                  <span className="inline-flex flex-col gap-0.5">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--success-wash)] px-2 py-0.5 text-[10px] font-semibold text-[var(--success)]">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Paid
                                    </span>
                                    <span className="text-[10px] text-muted">{p.paidAtLabel}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--warn-wash)] px-2 py-0.5 text-[10px] font-semibold text-[var(--warn)]">
                                    <CircleDashed className="h-3 w-3" />
                                    Pending
                                  </span>
                                )
                              ) : (
                                <span className="text-xs text-muted">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex flex-wrap justify-end gap-1">
                                {selectedRun.statusValue === "FINALIZED" ? (
                                  p.paymentStatusValue === "PAID" ? (
                                    <button
                                      type="button"
                                      disabled={pending}
                                      onClick={() => void markPayments([p.id], "PENDING")}
                                      className="text-[10px] text-muted underline"
                                    >
                                      Undo paid
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={pending}
                                      onClick={() => void markPayments([p.id], "PAID")}
                                      className="inline-flex items-center gap-1 rounded-md border border-[var(--success-line)] px-2 py-1 text-[10px] font-semibold text-[var(--success)]"
                                    >
                                      <Banknote className="h-3 w-3" />
                                      Mark paid
                                    </button>
                                  )
                                ) : null}
                                {selectedRun.statusValue === "DRAFT" ? (
                                  <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() => setAdjustmentTargetId(p.id)}
                                    className="inline-flex items-center gap-1 rounded-md border border-foreground/15 px-2 py-1 text-xs font-semibold hover:bg-foreground/[0.06] disabled:opacity-50"
                                  >
                                    <Plus className="h-3 w-3" />
                                    Adjust
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => setViewPayslipId(p.id)}
                                  className="inline-flex items-center gap-1 rounded-md border border-foreground/15 px-2 py-1 text-xs font-semibold hover:bg-foreground/[0.06]"
                                >
                                  <FileText className="h-3 w-3" />
                                  View / print
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-foreground/[0.04] font-semibold">
                          <td
                            className="px-4 py-2.5"
                            colSpan={selectedRun.statusValue === "FINALIZED" ? 3 : 2}
                          >
                            Totals ({filteredPayslips.length})
                            {selectedRun.statusValue === "FINALIZED"
                              ? ` · ${filteredPaymentStats.paid} paid`
                              : ""}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {currency} {runTotals.gross.toLocaleString("en-NG")}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {currency} {runTotals.payee.toLocaleString("en-NG")}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {currency} {runTotals.pension.toLocaleString("en-NG")}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {currency} {runTotals.net.toLocaleString("en-NG")}
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="px-4 py-12 text-center text-sm text-muted">Select or generate a payroll period.</p>
          )}
        </div>
      </div>

      <ModalOverlay
        open={Boolean(adjustmentTarget && selectedRun?.statusValue === "DRAFT")}
        onClose={() => {
          if (!pending) setAdjustmentTargetId(null);
        }}
        panelClassName={MODAL_PANEL_FORM}
        aria-labelledby="payroll-adjustment-title"
      >
        {adjustmentTarget && selectedRun ? (
          <>
            <div>
              <h2 id="payroll-adjustment-title" className="text-xl font-semibold text-foreground">
                Adjust {adjustmentTarget.employeeName} · {selectedRun.label}
              </h2>
              <p className="mt-1 text-sm text-muted">
                These items affect this month only. Contractual gross remains unchanged; gross and net pay recalculate
                immediately.
              </p>
            </div>

            {targetAdjustments.length > 0 ? (
              <div className="mt-4 space-y-2">
                {targetAdjustments.map((adjustment) => (
                  <div
                    key={adjustment.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-foreground/10 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{adjustment.label}</p>
                      <p className="text-[11px] text-muted">
                        {adjustment.type === "EARNING" ? "Earning" : "Deduction"} · {currency}{" "}
                        {adjustment.amount.toLocaleString("en-NG")}
                        {adjustment.type === "EARNING"
                          ? ` · ${adjustment.taxable ? "Taxable" : "Non-taxable"} · ${
                              adjustment.pensionable ? "Pensionable" : "Not pensionable"
                            }`
                          : ` · ${adjustment.preTax ? "Pre-tax" : "Post-tax"}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        void runAction(
                          () => deletePayrollAdjustment(tenantSlug, adjustment.id),
                          "Adjustment removed and payslip recalculated.",
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--danger-line)] px-2 py-1 text-xs font-semibold text-[var(--danger)] disabled:opacity-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-foreground/15 p-3 text-xs text-muted">
                No monthly adjustments yet.
              </p>
            )}

            <form
              className="mt-5 space-y-4 border-t border-foreground/10 pt-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const formData = new FormData(form);
                void runAction(
                  () =>
                    savePayrollAdjustment(tenantSlug, {
                      runId: selectedRun.id,
                      employeeProfileId: adjustmentTarget.employeeProfileId,
                      type: adjustmentType,
                      label: String(formData.get("label") || ""),
                      amount: Number(formData.get("amount")),
                      taxable: formData.get("taxable") === "on",
                      pensionable: formData.get("pensionable") === "on",
                      preTax: formData.get("preTax") === "on",
                    }),
                  "Adjustment added and payslip recalculated.",
                ).then((ok) => {
                  if (ok) form.reset();
                });
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium text-foreground">Adjustment type</span>
                  <UiSelect
                    value={adjustmentType}
                    onChange={(event) => setAdjustmentType(event.target.value as "EARNING" | "DEDUCTION")}
                  >
                    <option value="EARNING">Additional earning</option>
                    <option value="DEDUCTION">Deduction</option>
                  </UiSelect>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-medium text-foreground">Amount ({currency})</span>
                  <input
                    name="amount"
                    type="number"
                    min={0.01}
                    step={0.01}
                    required
                    className="w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-foreground">Description</span>
                  <input
                    name="label"
                    required
                    placeholder={
                      adjustmentType === "EARNING"
                        ? "Performance bonus, overtime, commission, reimbursement…"
                        : "Loan repayment, salary advance, other deduction…"
                    }
                    className="w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
                  />
                </label>
              </div>
              {adjustmentType === "EARNING" ? (
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input name="taxable" type="checkbox" defaultChecked />
                    Taxable
                  </label>
                  <label className="flex items-center gap-2">
                    <input name="pensionable" type="checkbox" />
                    Pensionable
                  </label>
                </div>
              ) : (
                <label className="flex items-center gap-2 text-sm">
                  <input name="preTax" type="checkbox" />
                  Deduct before tax
                </label>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setAdjustmentTargetId(null)}
                  className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-medium"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
                >
                  {pending ? "Recalculating…" : "Add and recalculate"}
                </button>
              </div>
            </form>
          </>
        ) : null}
      </ModalOverlay>

      {viewPayslip && selectedRun ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4 print:bg-white print:p-0">
          <div className="mx-auto max-w-3xl rounded-xl bg-background p-4 shadow-xl print:max-w-none print:shadow-none">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
              <button type="button" className="text-sm underline" onClick={() => setViewPayslipId(null)}>
                Close
              </button>
              <PdfDownloadButton filename={`payslip-${viewPayslip.employeeName}-${selectedRun.label}`}>
                Download PDF
              </PdfDownloadButton>
            </div>
            <PayslipPrintView
              companyName={companyName}
              brand={tenantBrand}
              periodLabel={selectedRun.label}
              employeeName={viewPayslip.employeeName}
              jobRole={viewPayslip.jobRole}
              paygroup={viewPayslip.paygroup}
              accountNumber={viewPayslip.accountNumber}
              bankName={viewPayslip.bankName}
              employeeId={viewPayslip.employeeId}
              taxId={viewPayslip.taxId}
              rsaPin={viewPayslip.rsaPin}
              pensionAdministrator={viewPayslip.pensionAdministrator}
              currency={currency}
              calc={viewPayslip.calc}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
