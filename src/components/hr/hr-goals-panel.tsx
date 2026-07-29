"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Target } from "lucide-react";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { groupGoalsByDepartment, type PerformanceGoalRow } from "@/lib/hr-goals-by-department";
import { updatePerformanceGoal, upsertPerformanceGoal } from "@/app/[tenantSlug]/hr/actions";

export function HrGoalsPanel({
  tenantSlug,
  goals,
  profileOptions,
  departments,
}: {
  tenantSlug: string;
  goals: PerformanceGoalRow[];
  profileOptions: Array<{ id: string; label: string; department: string }>;
  departments: string[];
}) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [pending, setPending] = useState(false);

  const summaries = useMemo(
    () =>
      groupGoalsByDepartment(
        goals,
        profileOptions.map((p) => ({ profileId: p.id, department: p.department })),
      ),
    [goals, profileOptions],
  );

  const filtered = useMemo(() => {
    if (deptFilter === "all") return summaries;
    return summaries.filter((s) => s.department === deptFilter);
  }, [summaries, deptFilter]);

  const deptOptions = useMemo(() => {
    const fromProfiles = departments.filter(Boolean);
    const fromGoals = summaries.map((s) => s.department);
    return Array.from(new Set([...fromProfiles, ...fromGoals, "Unassigned"])).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [departments, summaries]);

  async function runAction(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setPending(true);
    const result = await fn();
    setPending(false);
    if (!result.ok) {
      showSnackbar(result.error || "Something went wrong.", "error");
      return;
    }
    showSnackbar(success, "success");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-foreground/10 p-4">
          <p className="text-xs text-muted">Departments with goals</p>
          <p className="text-2xl font-bold">{summaries.length}</p>
        </div>
        <div className="rounded-lg border border-[var(--success-line)] bg-[var(--success-wash)] p-4">
          <p className="text-xs text-muted">Total goals</p>
          <p className="text-2xl font-bold text-[var(--success)]">{goals.length}</p>
        </div>
        <div className="rounded-lg border border-foreground/10 p-4">
          <p className="text-xs text-muted">Avg progress (all)</p>
          <p className="text-2xl font-bold">
            {goals.length ? Math.round(goals.reduce((s, g) => s + g.progressPercent, 0) / goals.length) : 0}%
          </p>
        </div>
      </div>

      <form
        className="grid gap-3 rounded-xl border border-foreground/10 p-4 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          void runAction(
            () =>
              upsertPerformanceGoal(tenantSlug, {
                employeeProfileId: String(fd.get("employeeProfileId") || ""),
                title: String(fd.get("title") || ""),
                description: String(fd.get("description") || ""),
                targetValue: String(fd.get("targetValue") || ""),
                progressPercent: Number(fd.get("progressPercent") || 0),
                dueDate: String(fd.get("dueDate") || ""),
              }),
            "Goal assigned.",
          );
          e.currentTarget.reset();
        }}
      >
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[10px] font-medium uppercase text-muted">Employee</label>
          <UiSelect name="employeeProfileId" required defaultValue="">
            <option value="" disabled>
              Select employee
            </option>
            {profileOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
                {p.department ? ` · ${p.department}` : ""}
              </option>
            ))}
          </UiSelect>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[10px] font-medium uppercase text-muted">Goal title</label>
          <input
            name="title"
            required
            placeholder="e.g. Close 12 unit sales in Q2"
            className="w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase text-muted">Due date</label>
          <input
            name="dueDate"
            type="date"
            className="w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
          />
        </div>
        <input
          name="description"
          placeholder="Optional detail"
          className="rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm sm:col-span-2"
        />
        <input
          name="targetValue"
          placeholder="Target (e.g. 12 units)"
          className="rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
        />
        <input
          name="progressPercent"
          type="number"
          min={0}
          max={100}
          defaultValue={0}
          placeholder="%"
          className="rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending || profileOptions.length === 0}
          className="rounded-md border border-foreground bg-foreground px-3 py-2 text-xs font-semibold text-background lg:col-span-2"
        >
          Add goal
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Filter department:</span>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="rounded-md border border-foreground/15 bg-field px-2 py-1 text-xs"
        >
          <option value="all">All departments</option>
          {deptOptions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-foreground/15 p-8 text-center text-sm text-muted">
          No performance goals yet. Assign goals by department to track progress on the employee dashboard.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((dept) => (
            <li key={dept.department} className="rounded-xl border border-foreground/10 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedDept(expandedDept === dept.department ? null : dept.department)}
                className="flex w-full flex-wrap items-center justify-between gap-3 bg-foreground/[0.02] px-4 py-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted" />
                  <span className="font-semibold text-foreground">{dept.department}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted">
                  <span>{dept.goalCount} goals</span>
                  <span>{dept.employeeCount} people</span>
                  <span>Avg {dept.avgProgress}%</span>
                  <span className="text-[var(--success)]">{dept.completedCount} done</span>
                </div>
              </button>
              {expandedDept === dept.department ? (
                <div className="border-t border-foreground/10 p-3">
                  <div className="mb-2 h-2 overflow-hidden rounded-full bg-foreground/10">
                    <div
                      className="h-full rounded-full bg-[var(--success)] transition-all"
                      style={{ width: `${dept.avgProgress}%` }}
                    />
                  </div>
                  <ul className="space-y-2">
                    {dept.goals.map((g) => (
                      <li
                        key={g.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-foreground/10 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{g.title}</p>
                          <p className="text-xs text-muted">
                            {g.employeeName}
                            {g.dueDateLabel !== "—" ? ` · Due ${g.dueDateLabel}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            defaultValue={g.progressPercent}
                            disabled={pending}
                            className="w-24"
                            onMouseUp={(e) => {
                              const v = Number((e.target as HTMLInputElement).value);
                              void runAction(
                                () =>
                                  updatePerformanceGoal(tenantSlug, {
                                    id: g.id,
                                    progressPercent: v,
                                    status: v >= 100 ? "COMPLETED" : "IN_PROGRESS",
                                  }),
                                "Progress updated.",
                              );
                            }}
                          />
                          <span className="w-10 text-right text-xs font-semibold tabular-nums">
                            {g.progressPercent}%
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
