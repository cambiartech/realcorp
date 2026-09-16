import { MembershipRole } from "@/generated/prisma";
import {
  mapOrgDepartmentToAccess,
  profileFromMembershipRole,
  type OrgDepartment,
} from "@/lib/org-membership-profile";
import { isOrgAdminOrSubAdmin } from "@/lib/org-admin-access";

/** Logical departments used for task assignment and org visibility. */
export type MembershipDepartment = OrgDepartment | "portal";

function departmentFromStored(
  role: MembershipRole,
  department?: string | null,
): MembershipDepartment | null {
  if (role === MembershipRole.INVESTOR || role === MembershipRole.LISTING_OWNER) return "portal";
  if (department) {
    const mapped = mapOrgDepartmentToAccess(department);
    if (mapped) return mapped;
  }
  return profileFromMembershipRole(role).department;
}

export type TaskAssigneeMember = {
  id: string;
  label: string;
  role: MembershipRole;
  department?: string | null;
  isDepartmentLead?: boolean;
};

function isHelpDeskAssignee(role: MembershipRole): boolean {
  // Anyone can request help from org operators / People leads.
  return isOrgAdminOrSubAdmin(role) || role === MembershipRole.HR_MANAGER;
}

/**
 * Who this person may assign tasks to.
 * - Org admin / Subadmin / HR / platform: anyone except portal-only roles
 * - Everyone else: their department teammates + org admins / subadmins / HR (for help)
 */
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
  const staff = members.filter((m) => departmentFromStored(m.role, m.department) !== "portal");

  if (canAssignTasksAcrossDepartments(opts.isPlatformAdmin, opts.actorRole)) {
    return staff;
  }

  const actorRole = opts.actorRole ?? MembershipRole.SALES_EXECUTIVE;
  const actorDept =
    (opts.actorDepartment ? mapOrgDepartmentToAccess(opts.actorDepartment) : null) ??
    profileFromMembershipRole(actorRole).department;

  const allowed = staff.filter((m) => {
    if (m.id === opts.actorUserId) return true;
    if (isHelpDeskAssignee(m.role)) return true;
    if (!actorDept) return false;
    return departmentFromStored(m.role, m.department) === actorDept;
  });

  // Stable unique by id (self + dept + admins may overlap).
  const seen = new Set<string>();
  return allowed.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

export function isTaskAssigneeAllowed(
  assigneeUserId: string | null | undefined,
  members: TaskAssigneeMember[],
  opts: Parameters<typeof filterTaskAssigneeMembers>[1],
): boolean {
  if (!assigneeUserId) return true;
  return filterTaskAssigneeMembers(members, opts).some((m) => m.id === assigneeUserId);
}

/** Org admin, Subadmin, HR, and platform admins may assign tasks across departments. */
export function canAssignTasksAcrossDepartments(
  isPlatformAdmin: boolean,
  role: MembershipRole | null | undefined,
): boolean {
  if (isPlatformAdmin) return true;
  if (!role) return false;
  return isOrgAdminOrSubAdmin(role) || role === MembershipRole.HR_MANAGER;
}

/** @deprecated use departmentFromStored */
export function membershipDepartment(role: MembershipRole): MembershipDepartment | null {
  return profileFromMembershipRole(role).department;
}
