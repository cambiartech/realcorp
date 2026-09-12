import { MembershipRole, MembershipStatus } from "@/generated/prisma";

/** Top organization admin — full control, including People / payroll. */
export function isTopOrgAdmin(role: MembershipRole | null | undefined): boolean {
  return role === MembershipRole.ORG_ADMIN;
}

/**
 * Organization admin or Subadmin — broad operational control.
 * Does not imply People / salary access (use canManageHr for that).
 */
export function isOrgAdminOrSubAdmin(role: MembershipRole | null | undefined): boolean {
  return role === MembershipRole.ORG_ADMIN || role === MembershipRole.SUB_ADMIN;
}

export function isActiveOrgAdminOrSubAdmin(
  membership: { status: MembershipStatus; role: MembershipRole } | null | undefined,
): boolean {
  return Boolean(
    membership &&
      membership.status === MembershipStatus.ACTIVE &&
      isOrgAdminOrSubAdmin(membership.role),
  );
}

/** Platform admins and top org admins only — can create/demote Organization admins. */
export function canGrantTopOrgAdmin(
  isPlatformAdmin: boolean,
  membership: { status: MembershipStatus; role: MembershipRole } | null | undefined,
): boolean {
  if (isPlatformAdmin) return true;
  return Boolean(
    membership &&
      membership.status === MembershipStatus.ACTIVE &&
      isTopOrgAdmin(membership.role),
  );
}
