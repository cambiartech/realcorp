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
  MembershipRole.SUB_ADMIN,
  MembershipRole.HOUSEKEEPING_MANAGER,
  MembershipRole.FNB_STAFF,
]);

const SHORTLETS_MANAGE_ROLES = new Set<MembershipRole>([
  MembershipRole.ORG_ADMIN,
  MembershipRole.SUB_ADMIN,
  MembershipRole.HOUSEKEEPING_MANAGER,
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

/** Explicit module grant that can mutate short-lets ops (not read-only). */
function hasShortletsEditGrant(ctx: ShortletsAccessContext): boolean {
  const level = shortletsPermissionLevel(ctx);
  return level === "full" || level === "edit";
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
  const r = role(ctx.membership);
  return r != null && SHORTLETS_MANAGE_ROLES.has(r);
}

/**
 * Room board / inspections mutations.
 * Full access and View & edit module grants must be able to mark rooms and assign staff —
 * previously only "full" counted, so Full-access ops could see Room board but not edit.
 */
export function canManageHousekeeping(ctx: ShortletsAccessContext): boolean {
  if (ctx.isPlatformAdmin) return true;
  if (!isActiveMember(ctx.membership)) return false;
  if (hasShortletsEditGrant(ctx)) return true;
  if (shortletsPermissionLevel(ctx) === "none" || shortletsPermissionLevel(ctx) === "read") {
    return false;
  }
  const r = role(ctx.membership);
  return r != null && SHORTLETS_MANAGE_ROLES.has(r);
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
    r === MembershipRole.SUB_ADMIN ||
    r === MembershipRole.FNB_STAFF ||
    r === MembershipRole.HOUSEKEEPING_MANAGER
  );
}

export function canViewShortletReports(ctx: ShortletsAccessContext): boolean {
  if (ctx.isPlatformAdmin) return true;
  if (!isActiveMember(ctx.membership)) return false;
  if (hasExplicitShortletsGrant(ctx)) return shortletsPermissionLevel(ctx) !== "none";
  const r = role(ctx.membership)!;
  return r === MembershipRole.ORG_ADMIN || r === MembershipRole.SUB_ADMIN || r === MembershipRole.HOUSEKEEPING_MANAGER;
}

/**
 * PMS settings. Org/sub admins always; explicit Full access also (matches Team → Full access label).
 * View & edit can operate day-to-day without changing org-wide PMS config.
 */
export function canManageShortletSettings(ctx: ShortletsAccessContext): boolean {
  if (ctx.isPlatformAdmin) return true;
  if (!isActiveMember(ctx.membership)) return false;
  if (shortletsPermissionLevel(ctx) === "full") return true;
  if (shortletsPermissionLevel(ctx) === "none" || shortletsPermissionLevel(ctx) === "read") {
    return false;
  }
  return ctx.membership!.role === MembershipRole.ORG_ADMIN || ctx.membership!.role === MembershipRole.SUB_ADMIN;
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
  // Managers land on Locations — the hub for multi-site portfolios
  return "locations";
}
