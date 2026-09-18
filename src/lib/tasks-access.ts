import { MembershipRole, MembershipStatus, type Prisma } from "@/generated/prisma";
import {
  mapOrgDepartmentToAccess,
  profileFromMembershipRole,
} from "@/lib/org-membership-profile";
import { isOrgAdminOrSubAdmin } from "@/lib/org-admin-access";

export function canManageTasks(
  isPlatformAdmin: boolean,
  membership: {
    status: MembershipStatus;
    role: MembershipRole;
    isDepartmentLead?: boolean | null;
  } | null,
) {
  if (isPlatformAdmin) return true;
  if (!membership || membership.status !== MembershipStatus.ACTIVE) return false;
  if (membership.isDepartmentLead) return true;
  return (
    membership.role === MembershipRole.ORG_ADMIN ||
    membership.role === MembershipRole.SUB_ADMIN ||
    membership.role === MembershipRole.HR_MANAGER ||
    membership.role === MembershipRole.SALES_MANAGER ||
    membership.role === MembershipRole.FINANCE_MANAGER ||
    membership.role === MembershipRole.MARKETING_MANAGER ||
    membership.role === MembershipRole.COMMUNITY_MANAGER ||
    membership.role === MembershipRole.HOUSEKEEPING_MANAGER ||
    membership.role === MembershipRole.FACILITY_MANAGER
  );
}

export function canViewTasksModule(
  isPlatformAdmin: boolean,
  membership: { status: MembershipStatus; role: MembershipRole } | null,
  moduleTasks: boolean,
) {
  if (!moduleTasks && !isPlatformAdmin) return false;
  return Boolean(isPlatformAdmin || (membership && membership.status === MembershipStatus.ACTIVE));
}

/**
 * Org admin, Subadmin, HR, and platform admins — full company task board.
 * Everyone else is scoped (department lead / assignee / creator).
 */
export function canViewAllOrgTasks(
  isPlatformAdmin: boolean,
  membership: { status: MembershipStatus; role: MembershipRole } | null,
) {
  if (isPlatformAdmin) return true;
  if (!membership || membership.status !== MembershipStatus.ACTIVE) return false;
  return isOrgAdminOrSubAdmin(membership.role) || membership.role === MembershipRole.HR_MANAGER;
}

function memberDepartmentKey(role: MembershipRole, department?: string | null) {
  if (department) {
    const mapped = mapOrgDepartmentToAccess(department);
    if (mapped) return mapped;
  }
  return profileFromMembershipRole(role).department;
}

/**
 * Prisma `where` for WorkTask lists.
 * - Org admin / Subadmin / HR / platform: all tenant tasks
 * - Department lead: own tasks + tasks they assigned + tasks assigned to their department
 * - Everyone else: assigned to them or created by them only
 */
export function workTaskVisibilityWhere(input: {
  tenantId: string;
  actorUserId: string;
  isPlatformAdmin: boolean;
  membership: {
    status: MembershipStatus;
    role: MembershipRole;
    department?: string | null;
    isDepartmentLead?: boolean | null;
  } | null;
  /** Active staff used to resolve department-lead teammate IDs. */
  members: Array<{
    id: string;
    role: MembershipRole;
    department?: string | null;
  }>;
}): Prisma.WorkTaskWhereInput {
  const base: Prisma.WorkTaskWhereInput = { tenantId: input.tenantId };
  if (canViewAllOrgTasks(input.isPlatformAdmin, input.membership)) {
    return base;
  }

  const ownOrCreated: Prisma.WorkTaskWhereInput[] = [
    { assigneeUserId: input.actorUserId },
    { createdByUserId: input.actorUserId },
  ];

  const membership = input.membership;
  if (membership?.status === MembershipStatus.ACTIVE && membership.isDepartmentLead) {
    const actorDept =
      (membership.department ? mapOrgDepartmentToAccess(membership.department) : null) ??
      profileFromMembershipRole(membership.role).department;
    if (actorDept) {
      const teammateIds = input.members
        .filter((m) => memberDepartmentKey(m.role, m.department) === actorDept)
        .map((m) => m.id);
      if (teammateIds.length) {
        return {
          ...base,
          OR: [
            ...ownOrCreated,
            { assigneeUserId: { in: teammateIds } },
            {
              AND: [{ assigneeUserId: null }, { createdByUserId: { in: teammateIds } }],
            },
          ],
        };
      }
    }
  }

  return { ...base, OR: ownOrCreated };
}

export function canAccessWorkTask(input: {
  isPlatformAdmin: boolean;
  actorUserId: string;
  membership: {
    status: MembershipStatus;
    role: MembershipRole;
    department?: string | null;
    isDepartmentLead?: boolean | null;
  } | null;
  task: { createdByUserId: string; assigneeUserId: string | null };
  members: Array<{
    id: string;
    role: MembershipRole;
    department?: string | null;
  }>;
}) {
  if (canViewAllOrgTasks(input.isPlatformAdmin, input.membership)) return true;
  if (input.task.assigneeUserId === input.actorUserId) return true;
  if (input.task.createdByUserId === input.actorUserId) return true;

  const membership = input.membership;
  if (!membership || membership.status !== MembershipStatus.ACTIVE || !membership.isDepartmentLead) {
    return false;
  }
  const actorDept =
    (membership.department ? mapOrgDepartmentToAccess(membership.department) : null) ??
    profileFromMembershipRole(membership.role).department;
  if (!actorDept) return false;

  const assigneeId = input.task.assigneeUserId;
  if (!assigneeId) {
    const creator = input.members.find((m) => m.id === input.task.createdByUserId);
    return creator ? memberDepartmentKey(creator.role, creator.department) === actorDept : false;
  }
  const assignee = input.members.find((m) => m.id === assigneeId);
  return assignee ? memberDepartmentKey(assignee.role, assignee.department) === actorDept : false;
}
