"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getEmployeeLeaveDetail } from "@/app/[tenantSlug]/hr/leave-actions";
import { normalizeGender } from "@/lib/hr-leave";

type BalanceRow = {
  leaveTypeId: string;
  name: string;
  dayUnit: string;
  available: number | null;
  unlimited: boolean;
  pending: number;
};

function unitLabel(dayUnit: string) {
  if (dayUnit === "CALENDAR_DAYS") return "cal. days";
  if (dayUnit === "HOURS") return "hours";
  return "work days";
}

export function EmployeeLeaveSidePanel({
  tenantSlug,
  employeeProfileId,
  gender,
}: {
  tenantSlug: string;
  employeeProfileId?: string | null;
  gender?: string | null;
}) {
  const [loading, setLoading] = useState(Boolean(employeeProfileId));
  const [error, setError] = useState<string | null>(null);
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [resolvedGender, setResolvedGender] = useState(normalizeGender(gender));

  useEffect(() => {
    setResolvedGender(normalizeGender(gender));
  }, [gender]);

  useEffect(() => {
    if (!employeeProfileId) {
      setBalances([]);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getEmployeeLeaveDetail(tenantSlug, employeeProfileId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        setBalances([]);
        return;
      }
      setYear(result.year);
      setResolvedGender(normalizeGender(result.employee.gender || gender));
      setBalances(
        result.balances.map((row) => ({
          leaveTypeId: row.leaveTypeId,
          name: row.name,
          dayUnit: row.dayUnit,
          available: row.available,
          unlimited: row.unlimited,
          pending: row.pending,
        })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [tenantSlug, employeeProfileId, gender]);

  const g = resolvedGender;
  const genderNote =
    g === "Male"
      ? "Male — maternity leave is not available."
      : g === "Female"
        ? "Female — maternity leave is available when policy allows."
        : "Set gender on the record so maternity / paternity eligibility is correct.";

  return (
    <aside className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Leave balances</p>
          <p className="text-[11px] text-muted">{year} · by gender eligibility</p>
        </div>
        {employeeProfileId ? (
          <Link
            href={`/${tenantSlug}/hr/leave?tab=balances`}
            className="shrink-0 text-[11px] font-semibold text-foreground underline"
          >
            Manage
          </Link>
        ) : null}
      </div>

      <div className="mb-3 rounded-md border border-foreground/10 bg-background/60 px-2.5 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Gender</p>
        <p className="mt-0.5 text-sm font-medium text-foreground">{g || "Not set"}</p>
        <p className="mt-1 text-[11px] leading-snug text-muted">{genderNote}</p>
      </div>

      {!employeeProfileId ? (
        <p className="text-xs text-muted">Save the HR record first to load leave entitlements.</p>
      ) : loading ? (
        <p className="text-xs text-muted">Loading leave…</p>
      ) : error ? (
        <p className="text-xs text-[var(--danger)]">{error}</p>
      ) : balances.length === 0 ? (
        <p className="text-xs text-muted">No eligible leave policies for this employee yet.</p>
      ) : (
        <ul className="space-y-2">
          {balances.map((row) => (
            <li
              key={row.leaveTypeId}
              className="flex items-baseline justify-between gap-2 border-b border-foreground/5 pb-2 last:border-0 last:pb-0"
            >
              <span className="text-xs text-foreground">{row.name}</span>
              <span className="shrink-0 text-right text-[11px] tabular-nums text-muted">
                {row.unlimited
                  ? "Unlimited"
                  : `${row.available ?? 0} ${unitLabel(row.dayUnit)}`}
                {row.pending > 0 ? (
                  <span className="mt-0.5 block text-[10px] text-[var(--warn)]">
                    {row.pending} pending
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
