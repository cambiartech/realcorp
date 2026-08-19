import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import {
  getExplicitModuleLevel,
  memberCanAccessModuleNav,
  parseMembershipModulePermissions,
  type MembershipModuleAccessLevel,
} from "@/lib/membership-module-permissions";

export type FacilityAccessContext = {
  isPlatformAdmin: boolean;
  membership: {
    status: MembershipStatus;
    role: MembershipRole;
    modulePermissions?: unknown;
  } | null;
  moduleFacility: boolean;
};

const FACILITY_DEFAULT_ROLES = new Set<MembershipRole>([
  MembershipRole.ORG_ADMIN,
  MembershipRole.FACILITY_MANAGER,
  MembershipRole.FACILITY_STAFF,
]);

function isActiveMember(membership: FacilityAccessContext["membership"]) {
  return membership?.status === MembershipStatus.ACTIVE;
}

function facilityPermissionLevel(ctx: FacilityAccessContext): MembershipModuleAccessLevel | null {
  return getExplicitModuleLevel(
    parseMembershipModulePermissions(ctx.membership?.modulePermissions),
    "facility",
  );
}

export function canViewFacilityModule(ctx: FacilityAccessContext) {
  if (ctx.isPlatformAdmin) return true;
  if (!ctx.moduleFacility) return false;
  if (!isActiveMember(ctx.membership)) return false;
  if (facilityPermissionLevel(ctx) === "none") return false;
  if (memberCanAccessModuleNav(facilityPermissionLevel(ctx))) return true;
  const role = ctx.membership?.role;
  return role != null && FACILITY_DEFAULT_ROLES.has(role);
}

export function canManageFacility(ctx: FacilityAccessContext) {
  if (ctx.isPlatformAdmin) return true;
  if (!canViewFacilityModule(ctx)) return false;
  const level = facilityPermissionLevel(ctx);
  if (level === "full" || level === "edit") return true;
  if (level === "read" || level === "none") return false;
  const role = ctx.membership?.role;
  return role === MembershipRole.ORG_ADMIN || role === MembershipRole.FACILITY_MANAGER;
}

export function canRecordFacility(ctx: FacilityAccessContext) {
  if (canManageFacility(ctx)) return true;
  if (!canViewFacilityModule(ctx)) return false;
  const level = facilityPermissionLevel(ctx);
  if (level === "read" || level === "none") return false;
  return true;
}
