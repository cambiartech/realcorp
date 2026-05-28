import { MembershipRole, MembershipStatus } from "@/generated/prisma";

export function canManageTasks(
  isPlatformAdmin: boolean,
  membership: { status: MembershipStatus; role: MembershipRole } | null,
) {
  if (isPlatformAdmin) return true;
  if (!membership || membership.status !== MembershipStatus.ACTIVE) return false;
  return (
    membership.role === MembershipRole.ORG_ADMIN ||
    membership.role === MembershipRole.HR_MANAGER ||
    membership.role === MembershipRole.SALES_MANAGER ||
    membership.role === MembershipRole.FINANCE_MANAGER ||
    membership.role === MembershipRole.MARKETING_MANAGER ||
    membership.role === MembershipRole.COMMUNITY_MANAGER
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
