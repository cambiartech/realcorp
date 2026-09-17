import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import {
  getExplicitModuleLevel,
  memberCanAccessModuleNav,
  parseMembershipModulePermissions,
  type MembershipModuleAccessLevel,
} from "@/lib/membership-module-permissions";

export type InventoryAccessContext = {
  isPlatformAdmin: boolean;
  membership: {
    status: MembershipStatus;
    role: MembershipRole;
    modulePermissions?: unknown;
  } | null;
  moduleInventory: boolean;
};

const INVENTORY_DEFAULT_ROLES = new Set<MembershipRole>([
  MembershipRole.ORG_ADMIN,
  MembershipRole.SUB_ADMIN,
  MembershipRole.FACILITY_MANAGER,
  MembershipRole.FACILITY_STAFF,
]);

function isActiveMember(membership: InventoryAccessContext["membership"]) {
  return membership?.status === MembershipStatus.ACTIVE;
}

function inventoryPermissionLevel(ctx: InventoryAccessContext): MembershipModuleAccessLevel | null {
  return getExplicitModuleLevel(
    parseMembershipModulePermissions(ctx.membership?.modulePermissions),
    "inventory",
  );
}

export function canViewInventoryModule(ctx: InventoryAccessContext) {
  if (ctx.isPlatformAdmin) return true;
  if (!ctx.moduleInventory) return false;
  if (!isActiveMember(ctx.membership)) return false;
  if (inventoryPermissionLevel(ctx) === "none") return false;
  if (memberCanAccessModuleNav(inventoryPermissionLevel(ctx))) return true;
  const role = ctx.membership?.role;
  return role != null && INVENTORY_DEFAULT_ROLES.has(role);
}

export function canManageInventory(ctx: InventoryAccessContext) {
  if (ctx.isPlatformAdmin) return true;
  if (!canViewInventoryModule(ctx)) return false;
  const level = inventoryPermissionLevel(ctx);
  if (level === "full" || level === "edit") return true;
  if (level === "read" || level === "none") return false;
  const role = ctx.membership?.role;
  return (
    role === MembershipRole.ORG_ADMIN ||
    role === MembershipRole.SUB_ADMIN ||
    role === MembershipRole.FACILITY_MANAGER
  );
}

export function canRecordInventory(ctx: InventoryAccessContext) {
  if (canManageInventory(ctx)) return true;
  if (!canViewInventoryModule(ctx)) return false;
  const level = inventoryPermissionLevel(ctx);
  if (level === "read" || level === "none") return false;
  return true;
}
