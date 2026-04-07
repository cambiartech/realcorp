import { MembershipRole } from "@/generated/prisma";

export type TenantNavKey =
  | "dashboard"
  | "projects"
  | "leads"
  | "deals"
  | "marketing"
  | "community"
  | "finance"
  | "team"
  | "settings";

export type TenantSettingsNavSlice = {
  moduleSales: boolean;
  moduleFinance: boolean;
  moduleMarketing: boolean;
  moduleCommunity: boolean;
  roleModuleGrants: unknown;
};

const NAV_ORDER: TenantNavKey[] = [
  "dashboard",
  "projects",
  "leads",
  "deals",
  "marketing",
  "community",
  "finance",
  "team",
  "settings",
];

const SALES_STACK: TenantNavKey[] = ["dashboard", "projects", "leads", "deals"];

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
};

function defaultNavForRole(role: MembershipRole, isPlatformAdmin: boolean): TenantNavKey[] {
  if (isPlatformAdmin) {
    return [...NAV_ORDER];
  }
  switch (role) {
    case MembershipRole.ORG_ADMIN:
      return [...NAV_ORDER];
    case MembershipRole.FINANCE_MANAGER:
      return [...SALES_STACK, "finance", "settings"];
    case MembershipRole.MARKETING_MANAGER:
      return ["dashboard", "projects", "leads", "marketing", "settings"];
    case MembershipRole.COMMUNITY_MANAGER:
      return ["dashboard", "community", "settings"];
    case MembershipRole.SALES_MANAGER:
    case MembershipRole.SALES_EXECUTIVE:
    default:
      return [...SALES_STACK, "settings"];
  }
}

function applyOrgModuleToggles(keys: TenantNavKey[], s: TenantSettingsNavSlice): TenantNavKey[] {
  return keys.filter((k) => {
    if (k === "marketing") return s.moduleMarketing;
    if (k === "community") return s.moduleCommunity;
    if (k === "finance") return s.moduleFinance;
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
    roleModuleGrants: raw?.roleModuleGrants ?? null,
  };
}

export function getVisibleNavKeys(opts: {
  role: MembershipRole | null | undefined;
  isPlatformAdmin: boolean;
  settings: TenantSettingsNavSlice;
}): TenantNavKey[] {
  const { role, isPlatformAdmin, settings } = opts;
  const r = role ?? MembershipRole.SALES_EXECUTIVE;
  let keys = defaultNavForRole(r, isPlatformAdmin);
  keys = applyOrgModuleToggles(keys, settings);
  const grants = parseGrants(settings.roleModuleGrants);
  keys = applyRoleGrants(keys, r, grants, settings);
  keys = applyOrgModuleToggles(keys, settings);
  return NAV_ORDER.filter((k) => keys.includes(k));
}

export function canAccessNavKey(
  key: TenantNavKey,
  opts: Parameters<typeof getVisibleNavKeys>[0],
): boolean {
  return getVisibleNavKeys(opts).includes(key);
}
