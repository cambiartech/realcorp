export type HrAnalyticsSnapshot = {
  teamSize: number;
  activeHeadcount: number;
  draftProfiles: number;
  exitedCount: number;
  joinersYtd: number;
  leaversYtd: number;
  openAppraisalCycles: number;
  overdueAppraisalCount: number;
  pendingSelfAppraisalCount: number;
  pendingManagerReviewCount: number;
  goalsInProgress: number;
  goalsCompleted: number;
  payrollReadyCount: number;
  missingGrossCount: number;
};

export function buildHrAnalytics(input: {
  teamSize: number;
  openAppraisalCycleCount: number;
  profiles: Array<{ status: string; dateOfJoining: Date | null; updatedAt: Date }>;
  appraisals: Array<{
    status: string;
    cycleStatus: string;
    cycleDueDate: Date | null;
  }>;
  goals: Array<{ status: string; progressPercent: number }>;
  payrollReadyCount: number;
  missingGrossCount: number;
}): HrAnalyticsSnapshot {
  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  const activeHeadcount = input.profiles.filter((p) => p.status === "ACTIVE").length;
  const draftProfiles = input.profiles.filter((p) => p.status === "DRAFT").length;
  const exitedCount = input.profiles.filter((p) => p.status === "EXITED").length;

  const joinersYtd = input.profiles.filter(
    (p) => p.status === "ACTIVE" && p.dateOfJoining && p.dateOfJoining >= yearStart,
  ).length;

  const leaversYtd = input.profiles.filter(
    (p) => p.status === "EXITED" && p.updatedAt >= yearStart,
  ).length;

  const now = new Date();
  const openAppraisals = input.appraisals.filter((a) => a.cycleStatus === "OPEN");

  let overdueAppraisalCount = 0;
  let pendingSelfAppraisalCount = 0;
  let pendingManagerReviewCount = 0;

  for (const a of openAppraisals) {
    if (a.status === "DRAFT") pendingSelfAppraisalCount += 1;
    if (a.status === "SELF_SUBMITTED") pendingManagerReviewCount += 1;
    if (a.cycleDueDate && a.cycleDueDate < now && a.status !== "REVIEWED") {
      overdueAppraisalCount += 1;
    }
  }

  const goalsCompleted = input.goals.filter(
    (g) => g.status === "COMPLETED" || g.progressPercent >= 100,
  ).length;
  const goalsInProgress = input.goals.length - goalsCompleted;

  return {
    teamSize: input.teamSize,
    activeHeadcount,
    draftProfiles,
    exitedCount,
    joinersYtd,
    leaversYtd,
    openAppraisalCycles: input.openAppraisalCycleCount,
    overdueAppraisalCount,
    pendingSelfAppraisalCount,
    pendingManagerReviewCount,
    goalsInProgress,
    goalsCompleted,
    payrollReadyCount: input.payrollReadyCount,
    missingGrossCount: input.missingGrossCount,
  };
}
