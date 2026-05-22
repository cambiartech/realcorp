export type PerformanceGoalRow = {
  id: string;
  employeeProfileId: string;
  employeeName: string;
  department: string;
  title: string;
  description: string;
  progressPercent: number;
  status: string;
  dueDateLabel: string;
};

export type DepartmentGoalsSummary = {
  department: string;
  employeeCount: number;
  goalCount: number;
  avgProgress: number;
  completedCount: number;
  goals: PerformanceGoalRow[];
};

export function groupGoalsByDepartment(
  goals: PerformanceGoalRow[],
  profileDepartments: Array<{ profileId: string; department: string }>,
): DepartmentGoalsSummary[] {
  const deptByProfile = new Map(profileDepartments.map((p) => [p.profileId, p.department || "Unassigned"]));

  const withDept = goals.map((g) => ({
    ...g,
    department: g.department || deptByProfile.get(g.employeeProfileId) || "Unassigned",
  }));

  const byDept = new Map<string, PerformanceGoalRow[]>();
  for (const g of withDept) {
    const key = g.department.trim() || "Unassigned";
    const list = byDept.get(key) ?? [];
    list.push(g);
    byDept.set(key, list);
  }

  const summaries: DepartmentGoalsSummary[] = [];
  for (const [department, deptGoals] of byDept) {
    const profileIds = new Set(deptGoals.map((g) => g.employeeProfileId));
    const completedCount = deptGoals.filter((g) => g.status === "COMPLETED" || g.progressPercent >= 100).length;
    const avgProgress =
      deptGoals.length > 0
        ? Math.round(deptGoals.reduce((s, g) => s + g.progressPercent, 0) / deptGoals.length)
        : 0;
    summaries.push({
      department,
      employeeCount: profileIds.size,
      goalCount: deptGoals.length,
      avgProgress,
      completedCount,
      goals: deptGoals.sort((a, b) => a.employeeName.localeCompare(b.employeeName)),
    });
  }

  return summaries.sort((a, b) => a.department.localeCompare(b.department));
}
