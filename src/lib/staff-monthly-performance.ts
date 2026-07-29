import { averageConfirmedRatings, averageSelfRatings, parseActionScores } from "@/lib/appraisal-scores";

export type StaffMonthlyPerformancePeriod = {
  year: number;
  month: number; // 1-12
  label: string;
  start: Date;
  end: Date;
};

export type StaffMonthlyMetricBreakdown = {
  appraisalScore: number | null;
  appraisalRating: number | null;
  appraisalStatus: string | null;
  tasksScore: number;
  tasksAssigned: number;
  tasksCompleted: number;
  tasksOnTime: number;
  departmentKpiScore: number;
  /** Department-specific raw counts for display */
  leads: number;
  dealsWon: number;
  dealValue: number;
  activities: number;
  goalsAvgProgress: number | null;
  metricLabel: string;
};

export type StaffMonthlyScoreEntry = {
  profileId: string;
  userId: string | null;
  name: string;
  department: string;
  position: string;
  compositeScore: number;
  rank: number;
  breakdown: StaffMonthlyMetricBreakdown;
};

type DeptWeights = {
  appraisal: number;
  tasks: number;
  departmentKpi: number;
  metricLabel: string;
};

function normalizeDepartment(dept: string | null | undefined): string {
  return (dept || "").trim() || "General";
}

function deptWeights(department: string | null | undefined): DeptWeights {
  const d = normalizeDepartment(department).toLowerCase();
  if (d.includes("sales")) {
    return { appraisal: 0.35, tasks: 0.25, departmentKpi: 0.4, metricLabel: "Leads & closed deals" };
  }
  if (d.includes("marketing")) {
    return { appraisal: 0.35, tasks: 0.25, departmentKpi: 0.4, metricLabel: "Leads & outreach activities" };
  }
  if (d.includes("finance")) {
    return { appraisal: 0.45, tasks: 0.35, departmentKpi: 0.2, metricLabel: "Activities & goal progress" };
  }
  if (d.includes("hr") || d.includes("people")) {
    return { appraisal: 0.45, tasks: 0.35, departmentKpi: 0.2, metricLabel: "Goals & team activities" };
  }
  if (d.includes("operations") || d.includes("ops")) {
    return { appraisal: 0.4, tasks: 0.4, departmentKpi: 0.2, metricLabel: "Site goals & activities" };
  }
  return { appraisal: 0.4, tasks: 0.35, departmentKpi: 0.25, metricLabel: "Goals & activities" };
}

export function monthPerformancePeriod(year: number, month: number): StaffMonthlyPerformancePeriod {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const label = new Intl.DateTimeFormat("en-NG", { month: "long", year: "numeric" }).format(start);
  return { year, month, label, start, end };
}

export function currentMonthPerformancePeriod(now = new Date()): StaffMonthlyPerformancePeriod {
  return monthPerformancePeriod(now.getFullYear(), now.getMonth() + 1);
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function inPeriod(d: Date | string, period: StaffMonthlyPerformancePeriod): boolean {
  const date = asDate(d);
  return date >= period.start && date < period.end;
}

function ratingToScore(rating: number | null | undefined): number | null {
  if (rating == null || rating < 0) return null;
  return Math.round((Math.min(rating, 5) / 5) * 100);
}

function relativeScore(value: number, teamMax: number): number {
  if (value <= 0) return 0;
  if (teamMax <= 0) return 0;
  return Math.round((value / teamMax) * 100);
}

function computeTasksScore(input: { assigned: number; completed: number; onTime: number }): number {
  if (input.assigned <= 0 && input.completed <= 0) return 0;
  const assigned = Math.max(input.assigned, input.completed, 1);
  const completionRate = input.completed / assigned;
  const onTimeRate = input.completed > 0 ? input.onTime / input.completed : 0;
  return Math.round(completionRate * 70 + onTimeRate * 30);
}

function computeDepartmentKpi(input: {
  department: string;
  leads: number;
  dealsWon: number;
  dealValue: number;
  activities: number;
  goalsAvgProgress: number | null;
  teamMax: { leads: number; dealsWon: number; dealValue: number; activities: number };
}): number {
  const d = normalizeDepartment(input.department).toLowerCase();

  if (d.includes("sales")) {
    const leadPts = relativeScore(input.leads, input.teamMax.leads) * 0.3;
    const dealPts = relativeScore(input.dealsWon, input.teamMax.dealsWon) * 0.45;
    const valuePts = relativeScore(input.dealValue, input.teamMax.dealValue) * 0.25;
    return Math.round(leadPts + dealPts + valuePts);
  }

  if (d.includes("marketing")) {
    const leadPts = relativeScore(input.leads, input.teamMax.leads) * 0.55;
    const actPts = relativeScore(input.activities, input.teamMax.activities) * 0.45;
    return Math.round(leadPts + actPts);
  }

  const goalsPts = input.goalsAvgProgress ?? 0;
  const actPts = relativeScore(input.activities, input.teamMax.activities);
  return Math.round(goalsPts * 0.65 + actPts * 0.35);
}

/** Monthly staff score: appraisal + tasks + department KPI (sales leads/deals, etc.). */
export function buildStaffMonthlyPerformance(input: {
  period: StaffMonthlyPerformancePeriod;
  profiles: Array<{
    id: string;
    userId: string | null;
    fullName: string;
    department: string | null;
    position: string | null;
    status: string;
  }>;
  tasks: Array<{
    assigneeUserId: string | null;
    status: string;
    dueDate: Date | string | null;
    completedAt: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
  }>;
  appraisals: Array<{
    employeeProfileId: string;
    status: string;
    overallRating: number | null;
    actionScores: unknown;
    cycleType: string;
    periodLabel: string;
  }>;
  appraisalActionIds: string[];
  leads: Array<{ assignedUserId: string | null; createdAt: Date | string }>;
  deals: Array<{
    assignedUserId: string | null;
    stage: string;
    value: unknown;
    updatedAt: Date | string;
  }>;
  activities: Array<{
    assignedUserId: string | null;
    completedAt: Date | string | null;
    createdAt: Date | string;
  }>;
  goals: Array<{ employeeProfileId: string; progressPercent: number; status: string }>;
}): StaffMonthlyScoreEntry[] {
  const activeProfiles = input.profiles.filter((p) => p.status === "ACTIVE" && p.userId);
  const userByProfile = new Map(activeProfiles.map((p) => [p.id, p.userId!]));
  const profileByUser = new Map(activeProfiles.map((p) => [p.userId!, p]));

  const monthlyAppraisalByProfile = new Map<string, (typeof input.appraisals)[number]>();
  for (const a of input.appraisals) {
    if (a.cycleType !== "MONTHLY") continue;
    if (a.periodLabel !== input.period.label) continue;
    monthlyAppraisalByProfile.set(a.employeeProfileId, a);
  }

  type RawStats = StaffMonthlyMetricBreakdown & { userId: string; profileId: string };
  const raw = new Map<string, RawStats>();

  for (const profile of activeProfiles) {
    const weights = deptWeights(profile.department);
    raw.set(profile.userId!, {
      userId: profile.userId!,
      profileId: profile.id,
      appraisalScore: null,
      appraisalRating: null,
      appraisalStatus: null,
      tasksScore: 0,
      tasksAssigned: 0,
      tasksCompleted: 0,
      tasksOnTime: 0,
      departmentKpiScore: 0,
      leads: 0,
      dealsWon: 0,
      dealValue: 0,
      activities: 0,
      goalsAvgProgress: null,
      metricLabel: weights.metricLabel,
    });
  }

  for (const task of input.tasks) {
    const uid = task.assigneeUserId;
    if (!uid || !raw.has(uid)) continue;
    const row = raw.get(uid)!;
    const relevant =
      inPeriod(task.createdAt, input.period) ||
      (task.completedAt && inPeriod(task.completedAt, input.period)) ||
      (task.dueDate && inPeriod(task.dueDate, input.period));
    if (!relevant) continue;

    row.tasksAssigned += 1;
    if (task.status === "DONE" && task.completedAt && inPeriod(task.completedAt, input.period)) {
      row.tasksCompleted += 1;
      const completedAt = asDate(task.completedAt);
      const dueDate = task.dueDate ? asDate(task.dueDate) : null;
      if (!dueDate || completedAt <= dueDate) {
        row.tasksOnTime += 1;
      }
    }
  }

  for (const [uid, row] of raw) {
    row.tasksScore = computeTasksScore({
      assigned: row.tasksAssigned,
      completed: row.tasksCompleted,
      onTime: row.tasksOnTime,
    });
  }

  for (const lead of input.leads) {
    const uid = lead.assignedUserId;
    if (!uid || !raw.has(uid) || !inPeriod(lead.createdAt, input.period)) continue;
    raw.get(uid)!.leads += 1;
  }

  for (const deal of input.deals) {
    const uid = deal.assignedUserId;
    if (!uid || !raw.has(uid) || deal.stage !== "CLOSED_WON") continue;
    if (!inPeriod(deal.updatedAt, input.period)) continue;
    const row = raw.get(uid)!;
    row.dealsWon += 1;
    row.dealValue += Number(deal.value || 0);
  }

  for (const activity of input.activities) {
    const uid = activity.assignedUserId;
    if (!uid || !raw.has(uid)) continue;
    const when = activity.completedAt ?? activity.createdAt;
    if (!inPeriod(when, input.period)) continue;
    raw.get(uid)!.activities += 1;
  }

  for (const goal of input.goals) {
    const uid = userByProfile.get(goal.employeeProfileId);
    if (!uid || !raw.has(uid)) continue;
    const row = raw.get(uid)!;
    const progress = goal.status === "COMPLETED" ? 100 : goal.progressPercent;
    row.goalsAvgProgress =
      row.goalsAvgProgress == null ? progress : Math.round((row.goalsAvgProgress + progress) / 2);
  }

  const teamMax = {
    leads: Math.max(0, ...Array.from(raw.values()).map((r) => r.leads)),
    dealsWon: Math.max(0, ...Array.from(raw.values()).map((r) => r.dealsWon)),
    dealValue: Math.max(0, ...Array.from(raw.values()).map((r) => r.dealValue)),
    activities: Math.max(0, ...Array.from(raw.values()).map((r) => r.activities)),
  };

  for (const [uid, row] of raw) {
    const profile = profileByUser.get(uid)!;
    const appraisal = monthlyAppraisalByProfile.get(profile.id);
    if (appraisal) {
      row.appraisalStatus = appraisal.status;
      const scores = parseActionScores(appraisal.actionScores);
      const actionIds = input.appraisalActionIds;

      if (appraisal.status === "REVIEWED") {
        const rating = appraisal.overallRating ?? averageConfirmedRatings(scores, actionIds) ?? null;
        row.appraisalRating = rating;
        row.appraisalScore = ratingToScore(rating);
      } else if (appraisal.status === "SELF_SUBMITTED") {
        const selfAvg = averageSelfRatings(scores, actionIds);
        row.appraisalRating = selfAvg ?? null;
        row.appraisalScore = ratingToScore(selfAvg != null ? selfAvg * 0.85 : null);
      }
    }

    row.departmentKpiScore = computeDepartmentKpi({
      department: profile.department ?? "",
      leads: row.leads,
      dealsWon: row.dealsWon,
      dealValue: row.dealValue,
      activities: row.activities,
      goalsAvgProgress: row.goalsAvgProgress,
      teamMax,
    });
  }

  const entries: StaffMonthlyScoreEntry[] = Array.from(raw.values())
    .map((row) => {
      const profile = profileByUser.get(row.userId)!;
      const weights = deptWeights(profile.department);
      const parts: Array<{ weight: number; value: number | null }> = [
        { weight: weights.appraisal, value: row.appraisalScore },
        { weight: weights.tasks, value: row.tasksScore },
        { weight: weights.departmentKpi, value: row.departmentKpiScore },
      ];
      const activeWeight = parts.reduce((sum, p) => sum + (p.value != null ? p.weight : 0), 0);
      const composite =
        activeWeight > 0
          ? Math.round(parts.reduce((sum, p) => sum + (p.value ?? 0) * p.weight, 0) / activeWeight)
          : Math.round(row.tasksScore * weights.tasks + row.departmentKpiScore * weights.departmentKpi);

      return {
        profileId: row.profileId,
        userId: row.userId,
        name: profile.fullName || "Unnamed",
        department: normalizeDepartment(profile.department),
        position: profile.position || "",
        compositeScore: composite,
        rank: 0,
        breakdown: {
          appraisalScore: row.appraisalScore,
          appraisalRating: row.appraisalRating,
          appraisalStatus: row.appraisalStatus,
          tasksScore: row.tasksScore,
          tasksAssigned: row.tasksAssigned,
          tasksCompleted: row.tasksCompleted,
          tasksOnTime: row.tasksOnTime,
          departmentKpiScore: row.departmentKpiScore,
          leads: row.leads,
          dealsWon: row.dealsWon,
          dealValue: row.dealValue,
          activities: row.activities,
          goalsAvgProgress: row.goalsAvgProgress,
          metricLabel: row.metricLabel,
        },
      };
    })
    .sort(
      (a, b) =>
        b.compositeScore - a.compositeScore ||
        b.breakdown.dealsWon - a.breakdown.dealsWon ||
        b.breakdown.tasksCompleted - a.breakdown.tasksCompleted ||
        a.name.localeCompare(b.name),
    );

  entries.forEach((e, idx) => {
    e.rank = idx + 1;
  });

  return entries;
}

export function formatStaffDealValue(value: number, currency = "NGN"): string {
  if (value <= 0) return "—";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
