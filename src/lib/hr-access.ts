import { MembershipRole, MembershipStatus } from "@/generated/prisma";

/**
 * Who can open People directory, payslips, remittances, and other employee personal/salary data.
 * Top organization admins and HR leads only — Subadmins are intentionally excluded.
 */
export function canManageHr(
  isPlatformAdmin: boolean,
  membership: { status: MembershipStatus; role: MembershipRole } | null,
) {
  if (isPlatformAdmin) return true;
  if (!membership || membership.status !== MembershipStatus.ACTIVE) return false;
  return membership.role === MembershipRole.ORG_ADMIN || membership.role === MembershipRole.HR_MANAGER;
}

export function canViewHrModule(
  isPlatformAdmin: boolean,
  membership: { status: MembershipStatus; role: MembershipRole } | null,
  moduleHr: boolean,
) {
  if (!moduleHr && !isPlatformAdmin) return false;
  return Boolean(isPlatformAdmin || (membership && membership.status === MembershipStatus.ACTIVE));
}
