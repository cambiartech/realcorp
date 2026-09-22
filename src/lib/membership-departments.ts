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
  return isOrgAdminOrSubAdmin(role) || role === MembershipRole.HR_MANAGER;
}

function isManagerAssigneeRole(role: MembershipRole | null | undefined): boolean {
  if (!role) return false;
  return (
    role === MembershipRole.SALES_MANAGER ||
    role === MembershipRole.FINANCE_MANAGER ||
    role === MembershipRole.MARKETING_MANAGER ||
    role === MembershipRole.COMMUNITY_MANAGER ||
    role === MembershipRole.HOUSEKEEPING_MANAGER ||
    role === MembershipRole.FACILITY_MANAGER ||
    role === MembershipRole.HR_MANAGER ||
    isOrgAdminOrSubAdmin(role)
  );
}

/**
 * Who this person may assign tasks to.
 * - Org admin / Subadmin / HR / platform / department leads / manager roles: any staff
 *   (e.g. Sales Manager → Front Desk / Operations)
 * - Explicit task managers: their designated reports (any department)
 * - Everyone else: their department teammates + org admins / subadmins / HR
 */
export function filterTaskAssigneeMembers(
  members: TaskAssigneeMember[],
  opts: {
    isPlatformAdmin: boolean;
    actorRole: MembershipRole | null | undefined;
    actorUserId: string;
    actorDepartment?: string | null;
    actorIsDepartmentLead?: boolean;
    /** User IDs this actor is allowed to assign across departments (EmployeeTaskManager). */
    manageeUserIds?: string[];
  },
): TaskAssigneeMember[] {
  const staff = members.filter((m) => departmentFromStored(m.role, m.department) !== "portal");

  if (canAssignTasksAcrossDepartments(opts.isPlatformAdmin, opts.actorRole, opts.actorIsDepartmentLead)) {
    return staff;
  }

  const manageeSet = new Set(opts.manageeUserIds ?? []);
  const actorRole = opts.actorRole ?? MembershipRole.SALES_EXECUTIVE;
  const actorDept =
    (opts.actorDepartment ? mapOrgDepartmentToAccess(opts.actorDepartment) : null) ??
    profileFromMembershipRole(actorRole).department;

  const allowed = staff.filter((m) => {
    if (m.id === opts.actorUserId) return true;
    if (manageeSet.has(m.id)) return true;
    if (isHelpDeskAssignee(m.role)) return true;
    if (!actorDept) return false;
    return departmentFromStored(m.role, m.department) === actorDept;
  });

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

/**
 * Org admin, Subadmin, HR, platform, department leads, and named manager roles
 * may assign tasks across departments (Sales → Front Desk, etc.).
 */
export function canAssignTasksAcrossDepartments(
  isPlatformAdmin: boolean,
  role: MembershipRole | null | undefined,
  isDepartmentLead?: boolean | null,
): boolean {
  if (isPlatformAdmin) return true;
  if (isDepartmentLead) return true;
  return isManagerAssigneeRole(role);
}

/** @deprecated use departmentFromStored */
export function membershipDepartment(role: MembershipRole): MembershipDepartment | null {
  return profileFromMembershipRole(role).department;
}
