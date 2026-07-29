import { HrFormRequestStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import {
  buildStaffMonthlyPerformance,
  currentMonthPerformancePeriod,
  type StaffMonthlyScoreEntry,
} from "@/lib/staff-monthly-performance";

export type HrDashboardMetrics = {
  enabled: boolean;
  periodLabel: string;
  hrPageUrl: string;
  activeMemberCount: number;
  pendingInviteCount: number;
  employeeProfileCount: number;
  activeEmployeeCount: number;
  pendingFormCount: number;
  openAppraisalCount: number;
  topPerformers: Array<{
    name: string;
    department: string;
    rank: number;
    compositeScore: number;
    tasksCompleted: number;
    tasksAssigned: number;
    tasksScore: number;
  }>;
};

const EMPTY: HrDashboardMetrics = {
  enabled: false,
  periodLabel: "",
  hrPageUrl: "",
  activeMemberCount: 0,
  pendingInviteCount: 0,
  employeeProfileCount: 0,
  activeEmployeeCount: 0,
  pendingFormCount: 0,
  openAppraisalCount: 0,
  topPerformers: [],
};

export async function loadHrDashboardMetrics(
  tenantId: string,
  tenantSlug: string,
  moduleHr: boolean,
): Promise<HrDashboardMetrics> {
  if (!moduleHr) {
    return { ...EMPTY, hrPageUrl: `/${tenantSlug}/hr` };
  }

  const period = currentMonthPerformancePeriod();
  const now = new Date();

  const [
    activeMemberCount,
    pendingInviteCount,
    employeeProfileCount,
    activeEmployeeCount,
    pendingFormCount,
    openAppraisalCount,
    profiles,
    tasks,
  ] = await Promise.all([
    prisma.membership.count({
      where: { tenantId, status: "ACTIVE" },
    }),
    prisma.invitation.count({
      where: { tenantId, acceptedAt: null, expiresAt: { gt: now } },
    }),
    prisma.employeeProfile.count({ where: { tenantId } }),
    prisma.employeeProfile.count({ where: { tenantId, status: "ACTIVE" } }),
    prisma.hrFormRequest.count({
      where: {
        tenantId,
        status: { in: [HrFormRequestStatus.PENDING] },
        expiresAt: { gt: now },
      },
    }),
    prisma.hrAppraisal.count({
      where: {
        tenantId,
        status: { in: ["DRAFT", "SELF_SUBMITTED"] },
        cycle: { status: "OPEN" },
      },
    }),
    prisma.employeeProfile.findMany({
      where: { tenantId },
      select: {
        id: true,
        userId: true,
        fullName: true,
        department: true,
        position: true,
        status: true,
      },
      take: 500,
    }),
    prisma.workTask.findMany({
      where: { tenantId },
      select: {
        assigneeUserId: true,
        status: true,
        dueDate: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 5000,
    }),
  ]);

  const scores: StaffMonthlyScoreEntry[] = buildStaffMonthlyPerformance({
    period,
    profiles: profiles.map((p) => ({
      id: p.id,
      userId: p.userId,
      fullName: p.fullName || "Unnamed",
      department: p.department,
      position: p.position,
      status: p.status,
    })),
    tasks,
    appraisals: [],
    appraisalActionIds: [],
    leads: [],
    deals: [],
    activities: [],
    goals: [],
  });

  const topPerformers = scores.slice(0, 5).map((entry) => ({
    name: entry.name,
    department: entry.department,
    rank: entry.rank,
    compositeScore: entry.compositeScore,
    tasksCompleted: entry.breakdown.tasksCompleted,
    tasksAssigned: entry.breakdown.tasksAssigned,
    tasksScore: entry.breakdown.tasksScore,
  }));

  return {
    enabled: true,
    periodLabel: period.label,
    hrPageUrl: `/${tenantSlug}/hr`,
    activeMemberCount,
    pendingInviteCount,
    employeeProfileCount,
    activeEmployeeCount,
    pendingFormCount,
    openAppraisalCount,
    topPerformers,
  };
}
