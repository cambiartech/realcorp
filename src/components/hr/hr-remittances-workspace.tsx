"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { downloadRemittanceSchedulesXlsx } from "@/lib/hr-remittance-xlsx";
import {
  buildRemittanceSchedules,
  remittanceGrandTotal,
  type RemittanceKind,
  type RemittanceSchedule,
} from "@/lib/hr-remittances";
import type { PayslipCalculation } from "@/lib/hr-payslip";

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

type RemittancePayslip = {
  employeeName: string;
  department: string;
  taxId: string;
  rsaPin: string;
  pensionAdministrator: string;
  nhfMembershipNumber: string;
  calc: PayslipCalculation;
};

type RemittanceRun = {
  id: string;
  label: string;
  year: number;
  month: number;
  status: string;
  statusValue: string;
  payslips: RemittancePayslip[];
};

function moneyLabel(currency: string, value: number) {
  return `${currency} ${value.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function identityHeader(kind: RemittanceKind) {
  if (kind === "PAYE") return "TIN";
  if (kind === "PENSION") return "RSA PIN";
  if (kind === "NHF") return "NHF number";
  return "Reference";
}

function identityValue(kind: RemittanceKind, row: RemittanceSchedule["rows"][number]) {
  if (kind === "PAYE") return row.taxId || "Missing TIN";
  if (kind === "PENSION") return row.rsaPin || "Missing RSA PIN";
  if (kind === "NHF") return row.nhfMembershipNumber || "Missing NHF number";
  return "—";
}

export function HrRemittancesWorkspace({
  tenantSlug,
  companyName,
  currency,
  payslipRuns,
}: {
  tenantSlug: string;
  companyName: string;
  currency: string;
  payslipRuns: RemittanceRun[];
}) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(payslipRuns[0]?.id ?? null);
  const [tab, setTab] = useState<RemittanceKind>("PENSION");
  const [exporting, setExporting] = useState(false);

  const selectedRun = useMemo(
    () => payslipRuns.find((run) => run.id === selectedRunId) ?? payslipRuns[0] ?? null,
    [payslipRuns, selectedRunId],
  );

  const schedules = useMemo(
    () => (selectedRun ? buildRemittanceSchedules(selectedRun.payslips) : null),
    [selectedRun],
  );

  const active = schedules
    ? { PAYE: schedules.paye, PENSION: schedules.pension, NHF: schedules.nhf, NSITF: schedules.nsitf }[tab]
    : null;

  const grandTotal = schedules ? remittanceGrandTotal(schedules) : 0;

  async function exportExcel() {
    if (!selectedRun || !schedules) return;
    setExporting(true);
    try {
      await downloadRemittanceSchedulesXlsx({
        companyName,
        currency,
        periodLabel: selectedRun.label || `${MONTHS[selectedRun.month - 1]} ${selectedRun.year}`,
        ...schedules,
        grandTotal,
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted">
          After you generate a payroll month, this is the schedule to file — PAYE, pension by PFA, NHF, and NSITF.
          Add RSA PIN and TIN on People → Job so each row is ready to remit.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${tenantSlug}/hr/payslips`}
            className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-semibold"
          >
            Back to payslips
          </Link>
          <button
            type="button"
            disabled={!schedules || exporting}
            onClick={() => void exportExcel()}
            className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
          >
            {exporting ? "Preparing…" : "Export Excel"}
          </button>
        </div>
      </div>

      {payslipRuns.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 px-4 py-6 text-sm text-muted">
          No payroll month yet.{" "}
          <Link href={`/${tenantSlug}/hr/payslips`} className="font-semibold underline">
            Generate payslips
          </Link>{" "}
          first, then come back here to file remittances.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-medium text-muted">Payroll month</label>
            <select
              value={selectedRun?.id ?? ""}
              onChange={(e) => setSelectedRunId(e.target.value)}
              className="rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
            >
              {payslipRuns.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.label} · {run.status}
                </option>
              ))}
            </select>
          </div>

          {schedules ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="PAYE" value={moneyLabel(currency, schedules.paye.total)} hint={schedules.paye.agency} />
              <Kpi label="Pension" value={moneyLabel(currency, schedules.pension.total)} hint={schedules.pension.agency} />
              <Kpi label="NHF" value={moneyLabel(currency, schedules.nhf.total)} hint={schedules.nhf.agency} />
              <Kpi label="NSITF" value={moneyLabel(currency, schedules.nsitf.total)} hint={schedules.nsitf.agency} />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 border-b border-foreground/10 pb-px">
            {(["PENSION", "PAYE", "NHF", "NSITF"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setTab(kind)}
                className={[
                  "border-b-2 px-3 py-2 text-sm font-semibold",
                  tab === kind
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted hover:text-foreground",
                ].join(" ")}
              >
                {kind === "PENSION" ? "Pension" : kind}
              </button>
            ))}
          </div>

          {active ? (
            <section className="overflow-hidden rounded-lg border border-foreground/10">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-foreground/10 px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold">{active.title}</h2>
                  <p className="text-xs text-muted">
                    File with {active.agency}. {active.rows.length} employee
                    {active.rows.length === 1 ? "" : "s"}
                    {active.missingIdentity > 0
                      ? ` · ${active.missingIdentity} missing ${identityHeader(active.kind).toLowerCase()}`
                      : ""}
                  </p>
                </div>
                <p className="text-sm font-semibold">{moneyLabel(currency, active.total)}</p>
              </div>
              {active.rows.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted">
                  Nothing to remit for this heading in {selectedRun?.label}.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-foreground/[0.03] text-xs uppercase text-muted">
                      <tr>
                        <th className="px-4 py-2">Employee</th>
                        <th className="px-4 py-2">{identityHeader(active.kind)}</th>
                        <th className="px-4 py-2">
                          {active.kind === "PENSION" ? "PFA" : "Administrator"}
                        </th>
                        <th className="px-4 py-2 text-right">Employee</th>
                        <th className="px-4 py-2 text-right">Employer</th>
                        <th className="px-4 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-foreground/10">
                      {active.rows.map((row) => (
                        <tr key={`${row.employeeName}-${row.rsaPin}-${row.taxId}`}>
                          <td className="px-4 py-3">
                            <p className="font-medium">{row.employeeName}</p>
                            <p className="text-xs text-muted">{row.department || "No department"}</p>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">
                            <span className={!identityValue(active.kind, row).startsWith("Missing") ? "" : "text-[var(--warn)]"}>
                              {identityValue(active.kind, row)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted">
                            {active.kind === "PENSION"
                              ? row.pensionAdministrator || "Add PFA on People → Job"
                              : active.agency}
                          </td>
                          <td className="px-4 py-3 text-right">{moneyLabel(currency, row.employeeAmount)}</td>
                          <td className="px-4 py-3 text-right">{moneyLabel(currency, row.employerAmount)}</td>
                          <td className="px-4 py-3 text-right font-semibold">{moneyLabel(currency, row.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-foreground/[0.03] font-semibold">
                        <td className="px-4 py-3" colSpan={3}>
                          Totals
                        </td>
                        <td className="px-4 py-3 text-right">{moneyLabel(currency, active.employeeTotal)}</td>
                        <td className="px-4 py-3 text-right">{moneyLabel(currency, active.employerTotal)}</td>
                        <td className="px-4 py-3 text-right">{moneyLabel(currency, active.total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-foreground/10 p-4">
      <p className="text-xs uppercase text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{hint}</p>
    </div>
  );
}
