import { MembershipRole, MembershipStatus } from "@/generated/prisma";

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
