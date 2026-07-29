"use client";

import Link from "next/link";
import { Download, Users } from "lucide-react";
import type { HrAnalyticsSnapshot } from "@/lib/hr-analytics";

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-lg border p-4",
        accent ? "border-[var(--accent-line)] bg-[var(--accent-wash)]" : "border-foreground/10",
      ].join(" ")}
    >
      <p className="text-xs text-muted">{label}</p>
      <p className={["text-2xl font-bold", accent ? "text-[var(--accent)]" : "text-foreground"].join(" ")}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-[10px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function HrInsightsWorkspace({
  tenantSlug,
  analytics,
}: {
  tenantSlug: string;
  analytics: HrAnalyticsSnapshot;
}) {
  const exportUrl = `/api/hr/${tenantSlug}/register?format=csv`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 h-5 w-5 text-muted" />
          <div>
            <p className="font-semibold text-foreground">Employee register</p>
            <p className="text-xs text-muted">
              Export active and draft profiles with job and pay fields for payroll or compliance.
            </p>
          </div>
        </div>
        <a
          href={exportUrl}
          className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-xs font-semibold text-background"
        >
          <Download className="h-3.5 w-3.5" />
          Download CSV
        </a>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Headcount & movement</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Team logins" value={analytics.teamSize} hint="Active memberships" />
          <StatCard
            label="Active employees"
            value={analytics.activeHeadcount}
            hint="Profiles marked ACTIVE"
            accent
          />
          <StatCard
            label="Joiners (YTD)"
            value={analytics.joinersYtd}
            hint="ACTIVE with joining date this year"
          />
          <StatCard
            label="Leavers (YTD)"
            value={analytics.leaversYtd}
            hint="EXITED status updated this year"
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Onboarding & payroll readiness</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Draft profiles" value={analytics.draftProfiles} />
          <StatCard label="Exited (all time)" value={analytics.exitedCount} />
          <StatCard label="Payroll ready" value={analytics.payrollReadyCount} hint="ACTIVE + gross pay set" />
          <StatCard
            label="Missing gross pay"
            value={analytics.missingGrossCount}
            hint={analytics.missingGrossCount > 0 ? "Fix under People → Job" : "All set"}
            accent={analytics.missingGrossCount > 0}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Appraisals & goals</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Open review periods" value={analytics.openAppraisalCycles} />
          <StatCard
            label="Overdue reviews"
            value={analytics.overdueAppraisalCount}
            accent={analytics.overdueAppraisalCount > 0}
          />
          <StatCard label="Awaiting self-review" value={analytics.pendingSelfAppraisalCount} />
          <StatCard label="Awaiting manager sign-off" value={analytics.pendingManagerReviewCount} accent />
          <StatCard label="Goals in progress" value={analytics.goalsInProgress} />
          <StatCard label="Goals completed" value={analytics.goalsCompleted} />
        </div>
      </div>

      <p className="text-xs text-muted">
        Manage records in{" "}
        <Link href={`/${tenantSlug}/hr/people`} className="font-semibold underline">
          People
        </Link>
        , payroll in{" "}
        <Link href={`/${tenantSlug}/hr/payslips`} className="font-semibold underline">
          Payslips
        </Link>
        , and reviews in{" "}
        <Link href={`/${tenantSlug}/hr/appraisals`} className="font-semibold underline">
          Appraisals
        </Link>
        .
      </p>
    </div>
  );
}
