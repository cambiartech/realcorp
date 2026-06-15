import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import {
  applyUserModulePermissionsToNavKeys,
  type MembershipModulePermissions,
} from "@/lib/membership-module-permissions";
import type { TenantModuleFlags } from "@/lib/tenant-module-definitions";

export type TenantNavKey =
  | "dashboard"
  | "portal"
  | "projects"
  | "clients"
  | "leads"
  | "deals"
  | "activities"
  | "tasks"
  | "marketing"
  | "listings"
  | "stakeholders"
  | "community"
  | "shortlets"
  | "finance"
  | "hr"
  | "team"
  | "settings";

export type TenantSettingsNavSlice = {
  moduleSales: boolean;
  moduleFinance: boolean;
  moduleMarketing: boolean;
  moduleCommunity: boolean;
  moduleShortLets: boolean;
  moduleHr: boolean;
  moduleTasks: boolean;
  moduleClients: boolean;
  moduleListings?: boolean;
  moduleWhatsApp?: boolean;
  moduleInvestorPortal?: boolean;
  roleModuleGrants: unknown;
};

const NAV_ORDER: TenantNavKey[] = [
  "dashboard",
  "portal",
  "projects",
  "clients",
  "leads",
  "deals",
  "activities",
  "tasks",
  "marketing",
  "listings",
  "stakeholders",
  "community",
  "shortlets",
  "finance",
  "hr",
  "team",
  "settings",
];

const SALES_STACK: TenantNavKey[] = ["dashboard", "projects", "leads", "deals", "activities"];

/** Roles that only ever see the stakeholder portal (investors / listing owners). */
export const PORTAL_ONLY_ROLES: MembershipRole[] = [
  MembershipRole.INVESTOR,
  MembershipRole.LISTING_OWNER,
];

export function isPortalOnlyRole(role: MembershipRole | null | undefined): boolean {
  return role != null && PORTAL_ONLY_ROLES.includes(role);
}

function parseGrants(raw: unknown): Partial<Record<MembershipRole, string[]>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const roles = Object.values(MembershipRole) as string[];
  const out: Partial<Record<MembershipRole, string[]>> = {};
  for (const role of roles) {
    const v = o[role];
    if (Array.isArray(v)) {
      out[role as MembershipRole] = v.filter((x): x is string => typeof x === "string");
    }
  }
  return out;
}

/** Maps stored grant tokens (uppercase) to nav keys. */
const GRANT_TO_NAV: Record<string, TenantNavKey> = {
  MARKETING: "marketing",
  COMMUNITY: "community",
  FINANCE: "finance",
  HR: "hr",
  TASKS: "tasks",
};

function defaultNavForRole(role: MembershipRole, isPlatformAdmin: boolean): TenantNavKey[] {
  if (isPlatformAdmin) {
    return NAV_ORDER.filter((k) => k !== "portal");
  }
  switch (role) {
    case MembershipRole.INVESTOR:
    case MembershipRole.LISTING_OWNER:
      return ["portal", "settings"];
    case MembershipRole.ORG_ADMIN:
      return NAV_ORDER.filter((k) => k !== "portal");
    case MembershipRole.FINANCE_MANAGER:
      return [...SALES_STACK, "clients", "shortlets", "tasks", "finance", "settings"];
    case MembershipRole.HR_MANAGER:
      return ["dashboard", "tasks", "hr", "team", "settings"];
    case MembershipRole.MARKETING_MANAGER:
      return ["dashboard", "projects", "leads", "tasks", "marketing", "listings", "activities", "settings"];
    case MembershipRole.COMMUNITY_MANAGER:
      return ["dashboard", "tasks", "community", "settings"];
    case MembershipRole.HOUSEKEEPING_MANAGER:
      return ["dashboard", "shortlets", "settings"];
    case MembershipRole.FNB_STAFF:
      return ["dashboard", "shortlets", "settings"];
    case MembershipRole.SALES_MANAGER:
      return [...SALES_STACK, "clients", "shortlets", "tasks", "listings", "stakeholders", "settings"];
    case MembershipRole.SALES_EXECUTIVE:
    default:
      return [...SALES_STACK, "clients", "shortlets", "tasks", "settings"];
  }
}

function applyOrgModuleToggles(keys: TenantNavKey[], s: TenantSettingsNavSlice): TenantNavKey[] {
  return keys.filter((k) => {
    if (k === "portal") return s.moduleInvestorPortal !== false;
    if (k === "listings") return s.moduleListings !== false;
    if (k === "stakeholders") return s.moduleInvestorPortal === true;
    if (k === "marketing") return s.moduleMarketing;
    if (k === "community") return s.moduleCommunity;
    if (k === "shortlets") return s.moduleShortLets;
    if (k === "finance") return s.moduleFinance;
    if (k === "hr") return s.moduleHr;
    if (k === "tasks") return s.moduleTasks;
    if (k === "clients") return s.moduleClients;
    if (k === "activities") return s.moduleSales;
    if (SALES_STACK.includes(k)) return s.moduleSales;
    return true;
  });
}

function applyRoleGrants(
  keys: TenantNavKey[],
  role: MembershipRole,
  grants: Partial<Record<MembershipRole, string[]>>,
  s: TenantSettingsNavSlice,
): TenantNavKey[] {
  const extra = grants[role];
  if (!extra?.length) return keys;
  const set = new Set(keys);
  for (const token of extra) {
    const u = token.trim().toUpperCase();
    if (u === "SALES" && s.moduleSales) {
      for (const k of SALES_STACK) set.add(k);
      continue;
    }
    const nav = GRANT_TO_NAV[u];
    if (!nav) continue;
    if (nav === "marketing" && s.moduleMarketing) set.add("marketing");
    if (nav === "community" && s.moduleCommunity) set.add("community");
    if (nav === "finance" && s.moduleFinance) set.add("finance");
    if (nav === "hr" && s.moduleHr) set.add("hr");
    if (nav === "tasks" && s.moduleTasks) set.add("tasks");
  }
  return NAV_ORDER.filter((k) => set.has(k));
}

export function normalizeSettingsNavSlice(
  raw: Partial<TenantSettingsNavSlice> | null | undefined,
): TenantSettingsNavSlice {
  return {
    moduleSales: raw?.moduleSales ?? true,
    moduleFinance: raw?.moduleFinance ?? true,
    moduleMarketing: raw?.moduleMarketing ?? true,
    moduleCommunity: raw?.moduleCommunity ?? true,
    moduleShortLets: raw?.moduleShortLets ?? false,
    moduleHr: raw?.moduleHr ?? false,
    moduleTasks: raw?.moduleTasks ?? true,
    moduleClients: raw?.moduleClients ?? false,
    moduleListings: raw?.moduleListings,
    moduleWhatsApp: raw?.moduleWhatsApp,
    moduleInvestorPortal: raw?.moduleInvestorPortal,
    roleModuleGrants: raw?.roleModuleGrants ?? null,
  };
}

export function getVisibleNavKeys(opts: {
  role: MembershipRole | null | undefined;
  isPlatformAdmin: boolean;
  membershipStatus?: MembershipStatus | null;
  settings: TenantSettingsNavSlice;
  userModulePermissions?: MembershipModulePermissions | null;
}): TenantNavKey[] {
  const { role, isPlatformAdmin, settings, membershipStatus, userModulePermissions } = opts;
  const r = role ?? MembershipRole.SALES_EXECUTIVE;
  let keys = defaultNavForRole(r, isPlatformAdmin);
  keys = applyOrgModuleToggles(keys, settings);
  const grants = parseGrants(settings.roleModuleGrants);
  keys = applyRoleGrants(keys, r, grants, settings);
  keys = applyOrgModuleToggles(keys, settings);
  // Portal-only roles (investors / listing owners) never gain extra modules.
  const portalOnly = !isPlatformAdmin && isPortalOnlyRole(r);
  const active = isPlatformAdmin || membershipStatus === MembershipStatus.ACTIVE;
  if (!portalOnly && settings.moduleHr && active && !keys.includes("hr")) {
    const set = new Set(keys);
    set.add("hr");
    keys = NAV_ORDER.filter((k) => set.has(k));
  }
  if (!portalOnly && settings.moduleTasks && active && !keys.includes("tasks")) {
    const set = new Set(keys);
    set.add("tasks");
    keys = NAV_ORDER.filter((k) => set.has(k));
  }
  if (!isPlatformAdmin && r !== MembershipRole.ORG_ADMIN && !portalOnly) {
    keys = applyUserModulePermissionsToNavKeys(keys, userModulePermissions, settings as Partial<TenantModuleFlags>);
  }
  return NAV_ORDER.filter((k) => keys.includes(k));
}

export function canAccessNavKey(
  key: TenantNavKey,
  opts: Parameters<typeof getVisibleNavKeys>[0],
): boolean {
  return getVisibleNavKeys(opts).includes(key);
}
