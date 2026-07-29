"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, BarChart3, ClipboardList, ListChecks, Target, Users } from "lucide-react";
import { HrGoalsPanel } from "@/components/hr/hr-goals-panel";
import { HrMonthlyScoresPanel } from "@/components/hr/hr-monthly-scores-panel";
import { YearlyAppraisalArchive, type YearlyArchiveEntry } from "@/components/hr/yearly-appraisal-archive";
import type { PerformanceGoalRow } from "@/lib/hr-goals-by-department";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { AppraisalRatingSelect } from "@/components/hr/appraisal-rating-select";
import { RichTextDisplay, RichTextField } from "@/components/rich-text-field";
import { appraisalRatingLabel } from "@/lib/appraisal-competencies";
import { groupAppraisalActionsBySection, parseManagerAppraisalFormData } from "@/lib/appraisal-form-utils";
import {
  averageConfirmedRatings,
  getManagerRating,
  getSelfRating,
  parseActionScores,
  type AppraisalCriterionScore,
} from "@/lib/appraisal-scores";
import {
  buildStaffMonthlyPerformance,
  type StaffMonthlyPerformancePeriod,
  type StaffMonthlyScoreEntry,
} from "@/lib/staff-monthly-performance";
import {
  closeAppraisalCycle,
  createAppraisalActionItem,
  createAppraisalCycle,
  saveAppraisalReview,
} from "@/app/[tenantSlug]/hr/actions";

type WorkspaceTab = "scores" | "review" | "criteria" | "cycles" | "goals" | "archive";

export type AppraisalActionView = {
  id: string;
  title: string;
  description: string;
  cycleType: string;
  cycleTypeLabel: string;
  isActive: boolean;
  sortOrder?: number;
};

export type AppraisalCycleView = {
  id: string;
  cycleType: string;
  cycleTypeLabel: string;
  periodLabel: string;
  status: string;
  statusValue: string;
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
    actionScores: Record<string, AppraisalCriterionScore> | null;
  }>;
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SELF_SUBMITTED: "bg-[var(--accent-wash)] text-[var(--accent)]",
  REVIEWED: "bg-[var(--success-wash)] text-[var(--success)]",
};

export function HrAppraisalsWorkspace({
  tenantSlug,
  currency,
  appraisalActions,
  appraisalCycles,
  performanceGoals,
  profileOptions,
  departments,
  yearlyArchive,
  staffPerformancePeriods,
  staffPerformanceInput,
  staffMonthlyScoresDefault,
}: {
  tenantSlug: string;
  currency: string;
  appraisalActions: AppraisalActionView[];
  appraisalCycles: AppraisalCycleView[];
  performanceGoals: PerformanceGoalRow[];
  profileOptions: Array<{ id: string; label: string; department: string }>;
  departments: string[];
  yearlyArchive: YearlyArchiveEntry[];
  staffPerformancePeriods: Array<{ year: number; month: number; label: string; start: string; end: string }>;
  staffPerformanceInput: Parameters<typeof buildStaffMonthlyPerformance>[0] extends infer T
    ? T extends { period: unknown }
      ? Omit<T, "period">
      : never
    : never;
  staffMonthlyScoresDefault: StaffMonthlyScoreEntry[];
}) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [tab, setTab] = useState<WorkspaceTab>("scores");

  const monthlyCycles = useMemo(
    () => appraisalCycles.filter((c) => c.cycleType === "MONTHLY"),
    [appraisalCycles],
  );

  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(() => {
    const openMonthly = monthlyCycles.find((c) => c.statusValue === "OPEN");
    if (openMonthly) return openMonthly.id;
    return monthlyCycles[0]?.id ?? null;
  });

  const performancePeriods = useMemo(
    (): StaffMonthlyPerformancePeriod[] =>
      staffPerformancePeriods.map((p) => ({
        year: p.year,
        month: p.month,
        label: p.label,
        start: new Date(p.start),
        end: new Date(p.end),
      })),
    [staffPerformancePeriods],
  );

  const [scorePeriod, setScorePeriod] = useState<StaffMonthlyPerformancePeriod | null>(
    () => performancePeriods[performancePeriods.length - 1] ?? null,
  );

  const monthlyScores = useMemo(
    () =>
      scorePeriod
        ? buildStaffMonthlyPerformance({ period: scorePeriod, ...staffPerformanceInput })
        : staffMonthlyScoresDefault,
    [scorePeriod, staffPerformanceInput, staffMonthlyScoresDefault],
  );
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selectedCycle = useMemo(
    () => monthlyCycles.find((c) => c.id === selectedCycleId) ?? monthlyCycles[0] ?? null,
    [monthlyCycles, selectedCycleId],
  );

  const reviewAppraisal =
    reviewId && selectedCycle ? selectedCycle.appraisals.find((a) => a.id === reviewId) : null;

  const cycleActions = useMemo(() => {
    if (!selectedCycle) return [];
    return appraisalActions.filter((a) => a.cycleType === selectedCycle.cycleType && a.isActive);
  }, [appraisalActions, selectedCycle]);

  const queueCounts = useMemo(() => {
    const open = monthlyCycles.filter((c) => c.statusValue === "OPEN");
    const pending = open.flatMap((c) => c.appraisals).filter((a) => a.statusValue === "SELF_SUBMITTED");
    return { openCycles: open.length, pendingReview: pending.length };
  }, [monthlyCycles]);

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

  const tabs: { id: WorkspaceTab; label: string; icon: typeof ListChecks }[] = [
    { id: "scores", label: "Monthly scores", icon: BarChart3 },
    { id: "review", label: "Review queue", icon: Users },
    { id: "goals", label: "Performance goals", icon: Target },
    { id: "archive", label: "Yearly archive", icon: Archive },
    { id: "cycles", label: "Appraisal periods", icon: ClipboardList },
    { id: "criteria", label: "Rating criteria", icon: ListChecks },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-foreground/10 p-4">
          <p className="text-xs text-muted">Open monthly periods</p>
          <p className="text-2xl font-bold">{queueCounts.openCycles}</p>
        </div>
        <div className="rounded-lg border border-[var(--accent-line)] bg-[var(--accent-wash)] p-4">
          <p className="text-xs text-muted">Awaiting manager review (this month)</p>
          <p className="text-2xl font-bold text-[var(--accent)]">{queueCounts.pendingReview}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-foreground/10 p-0.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold",
              tab === t.id ? "bg-foreground text-background" : "text-muted",
            ].join(" ")}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "scores" && scorePeriod ? (
        <HrMonthlyScoresPanel
          period={scorePeriod}
          periods={performancePeriods}
          onPeriodChange={setScorePeriod}
          entries={monthlyScores}
          currency={currency}
        />
      ) : null}

      {tab === "goals" ? (
        <HrGoalsPanel
          tenantSlug={tenantSlug}
          goals={performanceGoals}
          profileOptions={profileOptions}
          departments={departments}
        />
      ) : null}

      {tab === "archive" ? <YearlyAppraisalArchive entries={yearlyArchive} /> : null}

      {tab === "criteria" ? (
        <div className="space-y-4">
          <form
            className="grid gap-3 rounded-xl border border-foreground/10 p-4 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              void runAction(
                () =>
                  createAppraisalActionItem(tenantSlug, {
                    title: String(fd.get("title") || ""),
                    description: String(fd.get("description") || ""),
                    cycleType: (fd.get("cycleType") as "MONTHLY" | "YEARLY") || "MONTHLY",
                  }),
                "Criterion added.",
              );
              e.currentTarget.reset();
            }}
          >
            <input
              name="title"
              placeholder="e.g. Meets deadlines"
              required
              className="rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm sm:col-span-2"
            />
            <input
              name="description"
              placeholder="Optional detail"
              className="rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
            />
            <UiSelect name="cycleType" defaultValue="MONTHLY">
              <option value="MONTHLY">Monthly review</option>
              <option value="YEARLY">Yearly review</option>
            </UiSelect>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md border border-foreground bg-foreground px-3 py-2 text-xs font-semibold text-background sm:col-span-2 lg:col-span-1"
            >
              Add criterion
            </button>
          </form>
          <div className="overflow-x-auto rounded-xl border border-foreground/10">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-foreground/10 bg-foreground/[0.03] text-xs uppercase text-muted">
                  <th className="px-4 py-2">Criterion</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {appraisalActions.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted">
                      Add monthly and yearly criteria staff will rate themselves on.
                    </td>
                  </tr>
                ) : (
                  appraisalActions.map((a) => (
                    <tr key={a.id} className="border-b border-foreground/10 last:border-0">
                      <td className="px-4 py-3 font-medium">{a.title}</td>
                      <td className="px-4 py-3 text-muted">{a.cycleTypeLabel}</td>
                      <td className="px-4 py-3 text-muted">{a.description || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "cycles" ? (
        <div className="space-y-4">
          <form
            className="flex flex-wrap items-end gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              void runAction(
                () =>
                  createAppraisalCycle(tenantSlug, {
                    cycleType: (fd.get("cycleType") as "MONTHLY" | "YEARLY") || "MONTHLY",
                    periodLabel: String(fd.get("periodLabel") || ""),
                    dueDate: String(fd.get("dueDate") || ""),
                  }),
                "Appraisal period opened for all active staff.",
              );
            }}
          >
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase text-muted">Review type</label>
              <UiSelect name="cycleType" defaultValue="MONTHLY">
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </UiSelect>
            </div>
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-[10px] font-medium uppercase text-muted">Period label</label>
              <input
                name="periodLabel"
                placeholder="e.g. March 2026 or Annual 2026"
                required
                className="w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase text-muted">Due date</label>
              <input
                name="dueDate"
                type="date"
                className="rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md border border-foreground bg-foreground px-4 py-2 text-xs font-semibold text-background"
            >
              Open period
            </button>
          </form>
          <ul className="space-y-2">
            {appraisalCycles.map((cycle) => (
              <li
                key={cycle.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-foreground/10 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-foreground">
                    {cycle.cycleTypeLabel} — {cycle.periodLabel}
                  </p>
                  <p className="text-xs text-muted">
                    {cycle.appraisals.length} staff · Due {cycle.dueDateLabel} · {cycle.status}
                  </p>
                </div>
                {cycle.statusValue === "OPEN" ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      void runAction(() => closeAppraisalCycle(tenantSlug, cycle.id), "Period closed.")
                    }
                    className="text-xs font-semibold text-[var(--danger)] underline"
                  >
                    Close period
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === "review" ? (
        <div className="flex flex-col gap-4 lg:flex-row">
          <aside className="w-full lg:w-52">
            <p className="mb-2 text-[10px] font-bold uppercase text-muted">Periods</p>
            <ul className="space-y-1">
              {monthlyCycles.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCycleId(c.id);
                      setReviewId(null);
                    }}
                    className={[
                      "w-full rounded-md border px-3 py-2 text-left text-sm",
                      selectedCycleId === c.id
                        ? "border-foreground/25 bg-foreground/[0.06] font-semibold"
                        : "border-foreground/10",
                    ].join(" ")}
                  >
                    {c.periodLabel}
                    <span className="block text-[10px] text-muted">{c.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <div className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-foreground/10">
            {selectedCycle ? (
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-foreground/10 bg-foreground/[0.03] text-xs uppercase text-muted">
                    <th className="px-4 py-2">Employee</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Rating</th>
                    <th className="px-4 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCycle.appraisals.map((a) => (
                    <tr key={a.id} className="border-b border-foreground/10 last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium">{a.employeeName}</p>
                        <p className="text-xs text-muted">{a.position}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={[
                            "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                            STATUS_STYLES[a.statusValue] ?? "bg-slate-100",
                          ].join(" ")}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {a.overallRating != null ? `${a.overallRating}/5` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setReviewId(a.id)}
                          className="text-xs font-semibold underline"
                        >
                          {a.statusValue === "REVIEWED" ? "View" : "Review"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="p-8 text-center text-sm text-muted">Open an appraisal period first.</p>
            )}
          </div>
        </div>
      ) : null}

      {reviewAppraisal && selectedCycle ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5 shadow-xl">
            <h2 className="text-lg font-semibold">Manager review — {reviewAppraisal.employeeName}</h2>
            <p className="text-xs text-muted">
              {selectedCycle.periodLabel} · {selectedCycle.cycleTypeLabel}
            </p>
            <p className="mt-2 text-xs text-muted">
              Review the employee&apos;s self-ratings (0–5), confirm or adjust each score, and add development
              notes.
              {selectedCycle.cycleType === "MONTHLY"
                ? " Confirmed scores feed the monthly performance ranking."
                : " Confirmed scores are recorded for this yearly review."}
            </p>

            {reviewAppraisal.selfNotes ? (
              <div className="mt-3 rounded-md border border-foreground/10 bg-foreground/[0.03] p-3">
                <p className="text-xs font-semibold text-muted">Employee summary</p>
                <RichTextDisplay html={reviewAppraisal.selfNotes} className="mt-1" />
              </div>
            ) : null}

            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const parsed = parseManagerAppraisalFormData(
                  fd,
                  cycleActions.map((a) => a.id),
                );
                void runAction(
                  () =>
                    saveAppraisalReview(tenantSlug, reviewAppraisal.id, {
                      managerNotes: parsed.managerNotes,
                      overallRating: parsed.overallRating,
                      actionResponses: parsed.actionResponses,
                    }),
                  "Review saved.",
                ).then(() => setReviewId(null));
              }}
            >
              {groupAppraisalActionsBySection(cycleActions).map((group) => (
                <div key={group.section}>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">{group.label}</p>
                  <div className="mt-2 space-y-3">
                    {group.actions.map((action) => {
                      const scores = parseActionScores(reviewAppraisal.actionScores);
                      const score = scores[action.id];
                      const selfRating = getSelfRating(score);
                      const managerRating = getManagerRating(score);
                      const isReadOnly = reviewAppraisal.statusValue === "REVIEWED";

                      return (
                        <div key={action.id} className="rounded-md border border-foreground/10 p-3">
                          <p className="text-sm font-medium">{action.title}</p>
                          {action.description ? (
                            <p className="mt-0.5 text-xs text-muted">{action.description}</p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                            <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5">
                              Employee: {appraisalRatingLabel(selfRating)}
                            </span>
                            {isReadOnly ? (
                              <span className="rounded-full bg-[var(--success-wash)] px-2 py-0.5 font-medium text-[var(--success)]">
                                Final: {appraisalRatingLabel(managerRating)}
                              </span>
                            ) : (
                              <AppraisalRatingSelect
                                name={`mgr_rating_${action.id}`}
                                defaultValue={managerRating ?? selfRating}
                                placeholder="Confirm score"
                                className="min-w-[11rem]"
                              />
                            )}
                          </div>
                          {score?.selfNotes ? (
                            <div className="mt-2 rounded border border-foreground/10 bg-foreground/[0.02] p-2">
                              <p className="text-[10px] font-semibold uppercase text-muted">Employee notes</p>
                              <RichTextDisplay html={score.selfNotes} className="mt-1" />
                            </div>
                          ) : null}
                          {isReadOnly && score?.managerNotes ? (
                            <div className="mt-2">
                              <p className="text-[10px] font-semibold uppercase text-muted">Your notes</p>
                              <RichTextDisplay html={score.managerNotes} className="mt-1" />
                            </div>
                          ) : !isReadOnly ? (
                            <RichTextField
                              name={`mgr_notes_${action.id}`}
                              defaultValue={score?.managerNotes ?? ""}
                              placeholder="Manager comments on this area (optional)"
                              minHeight="4rem"
                              className="mt-2"
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              <RichTextField
                name="managerNotes"
                label="Overall manager summary"
                defaultValue={reviewAppraisal.managerNotes}
                readOnly={reviewAppraisal.statusValue === "REVIEWED"}
                placeholder="Summary, development plan, and next steps"
                minHeight="5rem"
              />

              {reviewAppraisal.statusValue === "REVIEWED" ? (
                reviewAppraisal.overallRating != null ? (
                  <p className="text-sm font-medium">
                    Final overall: {appraisalRatingLabel(reviewAppraisal.overallRating)}
                  </p>
                ) : null
              ) : (
                <div className="flex flex-wrap items-end gap-3">
                  <label className="block text-sm">
                    <span className="mb-1 block text-xs font-medium text-muted">
                      Overall (optional override)
                    </span>
                    <AppraisalRatingSelect
                      name="overallRating"
                      defaultValue={
                        reviewAppraisal.overallRating ??
                        averageConfirmedRatings(
                          parseActionScores(reviewAppraisal.actionScores),
                          cycleActions.map((a) => a.id),
                        ) ??
                        getSelfRating(parseActionScores(reviewAppraisal.actionScores)[cycleActions[0]?.id])
                      }
                      placeholder="Auto from confirmed scores"
                    />
                  </label>
                  <p className="text-xs text-muted pb-2">
                    Leave blank to auto-calculate from confirmed criterion scores.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-foreground/10 pt-3">
                <button type="button" onClick={() => setReviewId(null)}>
                  {reviewAppraisal.statusValue === "REVIEWED" ? "Close" : "Cancel"}
                </button>
                {reviewAppraisal.statusValue !== "REVIEWED" ? (
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
                  >
                    Save review
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
