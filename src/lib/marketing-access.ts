import { MembershipRole, MembershipStatus } from "@/generated/prisma";

/** Platform admins can edit any org they can open. Org staff need an active marketing role. */
export function canEditMarketing(
  isPlatformAdmin: boolean,
  membership: { role: MembershipRole; status: MembershipStatus } | null | undefined,
) {
  if (isPlatformAdmin) return true;
  return (
    membership?.status === MembershipStatus.ACTIVE &&
    (membership.role === MembershipRole.ORG_ADMIN || membership.role === MembershipRole.MARKETING_MANAGER)
  );
}
