import { MembershipRole, MembershipStatus } from "@/generated/prisma";

export type ShortletsAccessContext = {
  isPlatformAdmin: boolean;
  membership: { status: MembershipStatus; role: MembershipRole } | null;
};

function isActiveMember(membership: ShortletsAccessContext["membership"]) {
  return membership?.status === MembershipStatus.ACTIVE;
}

function role(membership: ShortletsAccessContext["membership"]) {
  return membership?.role;
}

export function canAccessShortLets(ctx: ShortletsAccessContext): boolean {
  if (ctx.isPlatformAdmin) return true;
  if (!isActiveMember(ctx.membership)) return false;
  const r = role(ctx.membership)!;
  return (
    r === MembershipRole.ORG_ADMIN ||
    r === MembershipRole.SALES_MANAGER ||
    r === MembershipRole.FINANCE_MANAGER ||
    r === MembershipRole.HOUSEKEEPING_MANAGER ||
    r === MembershipRole.FNB_STAFF
  );
}

export function canManageShortLets(ctx: ShortletsAccessContext): boolean {
  if (ctx.isPlatformAdmin) return true;
  if (!isActiveMember(ctx.membership)) return false;
  const r = role(ctx.membership)!;
  return (
    r === MembershipRole.ORG_ADMIN ||
    r === MembershipRole.SALES_MANAGER ||
    r === MembershipRole.FINANCE_MANAGER
  );
}

export function canManageHousekeeping(ctx: ShortletsAccessContext): boolean {
  if (ctx.isPlatformAdmin) return true;
  if (!isActiveMember(ctx.membership)) return false;
  const r = role(ctx.membership)!;
  return (
    r === MembershipRole.ORG_ADMIN ||
    r === MembershipRole.HOUSEKEEPING_MANAGER ||
    r === MembershipRole.SALES_MANAGER
  );
}

export function canPostFolio(ctx: ShortletsAccessContext): boolean {
  if (ctx.isPlatformAdmin) return true;
  if (!isActiveMember(ctx.membership)) return false;
  const r = role(ctx.membership)!;
  return (
    r === MembershipRole.ORG_ADMIN ||
    r === MembershipRole.SALES_MANAGER ||
    r === MembershipRole.FINANCE_MANAGER ||
    r === MembershipRole.FNB_STAFF
  );
}

export function canViewShortletReports(ctx: ShortletsAccessContext): boolean {
  if (ctx.isPlatformAdmin) return true;
  if (!isActiveMember(ctx.membership)) return false;
  return role(ctx.membership) !== MembershipRole.FNB_STAFF;
}

export function canManageShortletSettings(ctx: ShortletsAccessContext): boolean {
  if (ctx.isPlatformAdmin) return true;
  if (!isActiveMember(ctx.membership)) return false;
  return ctx.membership!.role === MembershipRole.ORG_ADMIN;
}

export function defaultShortletsLanding(role: MembershipRole | null | undefined): string {
  if (role === MembershipRole.HOUSEKEEPING_MANAGER) return "rooms";
  if (role === MembershipRole.FNB_STAFF) return "folio";
  return "front-desk";
}
