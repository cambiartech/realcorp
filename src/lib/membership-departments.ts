import { MembershipRole } from "@/generated/prisma";
import type { OrgDepartment } from "@/lib/org-membership-profile";
import { profileFromMembershipRole } from "@/lib/org-membership-profile";

/** Logical departments used for task assignment and org visibility. */
export type MembershipDepartment = OrgDepartment | "portal";

function departmentFromStored(
  role: MembershipRole,
  department?: string | null,
  isDepartmentLead?: boolean,
): MembershipDepartment | null {
  if (department) return department as MembershipDepartment;
  const profile = profileFromMembershipRole(role);
  return profile.department;
}

function isDepartmentLeadMember(
  role: MembershipRole,
  isDepartmentLead?: boolean,
): boolean {
  if (isDepartmentLead != null) return isDepartmentLead;
  return profileFromMembershipRole(role).isDepartmentLead;
}

export type TaskAssigneeMember = {
  id: string;
  label: string;
  role: MembershipRole;
  department?: string | null;
  isDepartmentLead?: boolean;
};

export function filterTaskAssigneeMembers(
  members: TaskAssigneeMember[],
  opts: {
    isPlatformAdmin: boolean;
    actorRole: MembershipRole | null | undefined;
    actorUserId: string;
    actorDepartment?: string | null;
    actorIsDepartmentLead?: boolean;
  },
): TaskAssigneeMember[] {
  if (canAssignTasksAcrossDepartments(opts.isPlatformAdmin, opts.actorRole)) {
    return members.filter((m) => departmentFromStored(m.role, m.department) !== "portal");
  }

  const dept = opts.actorDepartment ?? profileFromMembershipRole(opts.actorRole ?? MembershipRole.SALES_EXECUTIVE).department;
  if (!dept) {
    const self = members.find((m) => m.id === opts.actorUserId);
    return self ? [self] : [];
  }

  return members.filter(
    (m) => departmentFromStored(m.role, m.department, m.isDepartmentLead) === dept,
  );
}

export function isTaskAssigneeAllowed(
  assigneeUserId: string | null | undefined,
  members: TaskAssigneeMember[],
  opts: Parameters<typeof filterTaskAssigneeMembers>[1],
): boolean {
  if (!assigneeUserId) return true;
  return filterTaskAssigneeMembers(members, opts).some((m) => m.id === assigneeUserId);
}

/** Org admin, HR, and platform admins may assign tasks across departments. */
export function canAssignTasksAcrossDepartments(
  isPlatformAdmin: boolean,
  role: MembershipRole | null | undefined,
): boolean {
  if (isPlatformAdmin) return true;
  if (!role) return false;
  return role === MembershipRole.ORG_ADMIN || role === MembershipRole.HR_MANAGER;
}

/** @deprecated use departmentFromStored */
export function membershipDepartment(role: MembershipRole): MembershipDepartment | null {
  return profileFromMembershipRole(role).department;
}
