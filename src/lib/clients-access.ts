import { MembershipRole, MembershipStatus } from "@/generated/prisma";

type MembershipSlice = { role: MembershipRole; status: MembershipStatus } | null;

export function canViewClientsModule(
  isPlatformAdmin: boolean,
  membership: MembershipSlice,
  moduleClients: boolean,
): boolean {
  if (isPlatformAdmin) return true;
  if (!moduleClients) return false;
  return membership?.status === MembershipStatus.ACTIVE;
}

export function canManageClients(isPlatformAdmin: boolean, membership: MembershipSlice): boolean {
  if (isPlatformAdmin) return true;
  if (!membership || membership.status !== MembershipStatus.ACTIVE) return false;
  return (
    membership.role === MembershipRole.ORG_ADMIN ||
    membership.role === MembershipRole.SALES_MANAGER ||
    membership.role === MembershipRole.FINANCE_MANAGER
  );
}
