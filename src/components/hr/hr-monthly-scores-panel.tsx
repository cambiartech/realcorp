"use client";

import type { StaffMonthlyPerformancePeriod, StaffMonthlyScoreEntry } from "@/lib/staff-monthly-performance";
import { formatStaffDealValue } from "@/lib/staff-monthly-performance";
import { appraisalRatingLabel } from "@/lib/appraisal-competencies";

export function HrMonthlyScoresPanel({
  period,
  periods,
  onPeriodChange,
  entries,
  currency,
}: {
  period: StaffMonthlyPerformancePeriod;
  periods: StaffMonthlyPerformancePeriod[];
  onPeriodChange: (p: StaffMonthlyPerformancePeriod) => void;
  entries: StaffMonthlyScoreEntry[];
  currency: string;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
        <p className="font-semibold text-foreground">Monthly staff performance</p>
        <p className="mt-1 text-xs text-muted">
          Composite score per employee for the selected month — combines{" "}
          <strong className="font-medium text-foreground">manager-confirmed appraisal</strong>,{" "}
          <strong className="font-medium text-foreground">task delivery</strong>, and{" "}
          <strong className="font-medium text-foreground">department KPIs</strong> (e.g. sales leads & closed
          deals, marketing outreach, goal progress for ops/HR).
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-muted">
            Month
            <select
              className="ml-2 rounded-md border border-foreground/15 bg-field px-2 py-1.5 text-sm text-foreground"
              value={`${period.year}-${period.month}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-").map(Number);
                const next = periods.find((p) => p.year === y && p.month === m);
                if (next) onPeriodChange(next);
              }}
            >
              {periods.map((p) => (
                <option key={`${p.year}-${p.month}`} value={`${p.year}-${p.month}`}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 p-8 text-center text-sm text-muted">
          No active employees with activity for {period.label} yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-foreground/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-foreground/10 bg-foreground/[0.03] text-xs uppercase text-muted">
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Employee</th>
                <th className="px-4 py-2">Dept KPI</th>
                <th className="px-4 py-2">Tasks</th>
                <th className="px-4 py-2">Appraisal</th>
                <th className="px-4 py-2 text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.profileId} className="border-b border-foreground/10 last:border-0">
                  <td className="px-4 py-3 font-semibold text-muted">{e.rank}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{e.name}</p>
                    <p className="text-xs text-muted">
                      {e.department}
                      {e.position ? ` · ${e.position}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-foreground">{e.breakdown.metricLabel}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      <DeptKpiDetail entry={e} currency={currency} />
                    </p>
                    <p className="text-[10px] text-muted">KPI index: {e.breakdown.departmentKpiScore}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    <p>
                      {e.breakdown.tasksCompleted}/{e.breakdown.tasksAssigned} done
                      {e.breakdown.tasksOnTime > 0 ? ` · ${e.breakdown.tasksOnTime} on time` : ""}
                    </p>
                    <p className="text-[10px]">Task score: {e.breakdown.tasksScore}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {e.breakdown.appraisalScore != null ? (
                      <>
                        <p>{appraisalRatingLabel(e.breakdown.appraisalRating)}</p>
                        <p className="text-[10px]">Appraisal: {e.breakdown.appraisalScore}</p>
                      </>
                    ) : (
                      <p>{e.breakdown.appraisalStatus === "DRAFT" ? "Not submitted" : "Pending review"}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-block rounded-full bg-foreground px-2.5 py-1 text-xs font-bold text-background">
                      {e.compositeScore}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-muted">
        Weights vary by department — Sales leans on leads &amp; deals; Marketing on leads &amp; activities;
        other teams on goals &amp; task delivery. Yearly appraisals are archived separately under Yearly
        archive.
      </p>
    </div>
  );
}

function DeptKpiDetail({ entry, currency }: { entry: StaffMonthlyScoreEntry; currency: string }) {
  const b = entry.breakdown;
  const d = entry.department.toLowerCase();
  if (d.includes("sales")) {
    return (
      <>
        {b.leads} leads · {b.dealsWon} won
        {b.dealValue > 0 ? ` · ${formatStaffDealValue(b.dealValue, currency)}` : ""}
      </>
    );
  }
  if (d.includes("marketing")) {
    return (
      <>
        {b.leads} leads · {b.activities} activities
      </>
    );
  }
  return (
    <>
      {b.goalsAvgProgress != null ? `${b.goalsAvgProgress}% goals` : "— goals"}
      {b.activities > 0 ? ` · ${b.activities} activities` : ""}
    </>
  );
}
