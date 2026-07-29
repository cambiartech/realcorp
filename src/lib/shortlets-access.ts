import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import {
  getExplicitModuleLevel,
  memberCanAccessModuleNav,
  parseMembershipModulePermissions,
  type MembershipModuleAccessLevel,
} from "@/lib/membership-module-permissions";

export type ShortletsAccessContext = {
  isPlatformAdmin: boolean;
  membership: {
    status: MembershipStatus;
    role: MembershipRole;
    modulePermissions?: unknown;
  } | null;
};

/** Roles that get Short lets by default (ops + org admin). Sales/finance need explicit module assignment. */
const SHORTLETS_DEFAULT_ROLES = new Set<MembershipRole>([
  MembershipRole.ORG_ADMIN,
  MembershipRole.HOUSEKEEPING_MANAGER,
  MembershipRole.FNB_STAFF,
]);

function isActiveMember(membership: ShortletsAccessContext["membership"]) {
  return membership?.status === MembershipStatus.ACTIVE;
}

function role(membership: ShortletsAccessContext["membership"]) {
  return membership?.role;
}

function shortletsPermissionLevel(ctx: ShortletsAccessContext): MembershipModuleAccessLevel | null {
  return getExplicitModuleLevel(
    parseMembershipModulePermissions(ctx.membership?.modulePermissions),
    "shortlets",
  );
}

function hasExplicitShortletsGrant(ctx: ShortletsAccessContext): boolean {
  return memberCanAccessModuleNav(shortletsPermissionLevel(ctx));
}

function hasDefaultShortletsRole(ctx: ShortletsAccessContext): boolean {
  const r = role(ctx.membership);
  return r != null && SHORTLETS_DEFAULT_ROLES.has(r);
}

export function canAccessShortLets(ctx: ShortletsAccessContext): boolean {
  if (ctx.isPlatformAdmin) return true;
  if (!isActiveMember(ctx.membership)) return false;
  if (shortletsPermissionLevel(ctx) === "none") return false;
  if (hasExplicitShortletsGrant(ctx)) return true;
  return hasDefaultShortletsRole(ctx);
}

export function canManageShortLets(ctx: ShortletsAccessContext): boolean {
  if (ctx.isPlatformAdmin) return true;
  if (!isActiveMember(ctx.membership)) return false;
  const level = shortletsPermissionLevel(ctx);
  if (level === "full" || level === "edit") return true;
  if (level === "none" || level === "read") return false;
  const r = role(ctx.membership)!;
  return r === MembershipRole.ORG_ADMIN || r === MembershipRole.HOUSEKEEPING_MANAGER;
}

export function canManageHousekeeping(ctx: ShortletsAccessContext): boolean {
  if (ctx.isPlatformAdmin) return true;
  if (!isActiveMember(ctx.membership)) return false;
  if (shortletsPermissionLevel(ctx) === "full") return true;
  const r = role(ctx.membership)!;
  return r === MembershipRole.ORG_ADMIN || r === MembershipRole.HOUSEKEEPING_MANAGER;
}

export function canPostFolio(ctx: ShortletsAccessContext): boolean {
  if (ctx.isPlatformAdmin) return true;
  if (!isActiveMember(ctx.membership)) return false;
  const level = shortletsPermissionLevel(ctx);
  if (level === "full" || level === "edit") return true;
  if (level === "none") return false;
  const r = role(ctx.membership)!;
  return (
    r === MembershipRole.ORG_ADMIN ||
    r === MembershipRole.FNB_STAFF ||
    r === MembershipRole.HOUSEKEEPING_MANAGER
  );
}

export function canViewShortletReports(ctx: ShortletsAccessContext): boolean {
  if (ctx.isPlatformAdmin) return true;
  if (!isActiveMember(ctx.membership)) return false;
  if (hasExplicitShortletsGrant(ctx)) return shortletsPermissionLevel(ctx) !== "none";
  const r = role(ctx.membership)!;
  return r === MembershipRole.ORG_ADMIN || r === MembershipRole.HOUSEKEEPING_MANAGER;
}

export function canManageShortletSettings(ctx: ShortletsAccessContext): boolean {
  if (ctx.isPlatformAdmin) return true;
  if (!isActiveMember(ctx.membership)) return false;
  return ctx.membership!.role === MembershipRole.ORG_ADMIN;
}

export function resolveShortletsAccess(ctx: ShortletsAccessContext) {
  return {
    canManage: canManageShortLets(ctx),
    canHousekeeping: canManageHousekeeping(ctx),
    canPostFolio: canPostFolio(ctx),
    canSettings: canManageShortletSettings(ctx),
    canReports: canViewShortletReports(ctx),
  };
}

export function defaultShortletsLanding(role: MembershipRole | null | undefined): string {
  if (role === MembershipRole.HOUSEKEEPING_MANAGER) return "rooms";
  if (role === MembershipRole.FNB_STAFF) return "folio";
  return "front-desk";
}
