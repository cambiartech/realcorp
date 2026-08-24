import type { TenantModuleField, TenantModuleFlags } from "@/lib/tenant-module-definitions";
import type { TenantNavKey } from "@/lib/tenant-nav-access";

/** Assignable module keys stored on Membership.modulePermissions */
export type MembershipModuleKey =
  | "sales"
  | "projects"
  | "finance"
  | "marketing"
  | "community"
  | "tasks"
  | "hr"
  | "clients"
  | "shortlets"
  | "listings"
  | "investor"
  | "facility";

export type MembershipModuleAccessLevel = "none" | "read" | "edit" | "full";

export type MembershipModulePermissions = Partial<Record<MembershipModuleKey, MembershipModuleAccessLevel>>;

export type AssignableMemberModule = {
  key: MembershipModuleKey;
  label: string;
  description: string;
  entitlement: TenantModuleField;
  navKeys: TenantNavKey[];
};

export const MEMBERSHIP_ASSIGNABLE_MODULES: AssignableMemberModule[] = [
  {
    key: "sales",
    label: "Sales",
    description: "Dashboard, leads, deals, activities",
    entitlement: "moduleSales",
    navKeys: ["dashboard", "leads", "deals", "activities"],
  },
  {
    key: "projects",
    label: "Projects",
    description: "Developments, inventory, apartments, and pricing",
    entitlement: "moduleSales",
    navKeys: ["projects"],
  },
  {
    key: "finance",
    label: "Finance",
    description: "Invoices, receipts, banking",
    entitlement: "moduleFinance",
    navKeys: ["finance"],
  },
  {
    key: "marketing",
    label: "Marketing",
    description: "Campaigns, forms, lead sources",
    entitlement: "moduleMarketing",
    navKeys: ["marketing"],
  },
  {
    key: "community",
    label: "Community",
    description: "Realtor partners and referrals",
    entitlement: "moduleCommunity",
    navKeys: ["community"],
  },
  {
    key: "tasks",
    label: "Tasks",
    description: "Work boards and assignments",
    entitlement: "moduleTasks",
    navKeys: ["tasks"],
  },
  {
    key: "hr",
    label: "People (HR)",
    description: "Employee records and payslips",
    entitlement: "moduleHr",
    navKeys: ["hr"],
  },
  {
    key: "clients",
    label: "Clients",
    description: "Property owners, sale balances, and client documents",
    entitlement: "moduleClients",
    navKeys: ["clients"],
  },
  {
    key: "shortlets",
    label: "Short lets",
    description: "Front desk, reservations, guest bill, PMS",
    entitlement: "moduleShortLets",
    navKeys: ["shortlets"],
  },
  {
    key: "listings",
    label: "Listings",
    description: "Public Explore listings",
    entitlement: "moduleListings",
    navKeys: ["listings"],
  },
  {
    key: "investor",
    label: "Investor portal",
    description: "Portfolio and stakeholders",
    entitlement: "moduleInvestorPortal",
    navKeys: ["portal", "stakeholders"],
  },
  {
    key: "facility",
    label: "Facility",
    description: "Site stores, usage, plant, and damages",
    entitlement: "moduleFacility",
    navKeys: ["facility"],
  },
];

export const MEMBERSHIP_MODULE_ACCESS_OPTIONS: Array<{
  value: "" | MembershipModuleAccessLevel;
  label: string;
  hint: string;
}> = [
  { value: "", label: "Use job role default", hint: "Inherit from job role and Settings → Modules" },
  { value: "none", label: "No access", hint: "Hide this module for this person" },
  { value: "read", label: "Read only", hint: "View records — no create or edit" },
  { value: "edit", label: "View & edit", hint: "Update existing records" },
  { value: "full", label: "Full access", hint: "View, edit, create, and manage" },
];

const LEVELS = new Set<MembershipModuleAccessLevel>(["none", "read", "edit", "full"]);

export function parseMembershipModulePermissions(raw: unknown): MembershipModulePermissions {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: MembershipModulePermissions = {};
  for (const mod of MEMBERSHIP_ASSIGNABLE_MODULES) {
    const v = o[mod.key];
    if (typeof v === "string" && LEVELS.has(v as MembershipModuleAccessLevel)) {
      out[mod.key] = v as MembershipModuleAccessLevel;
    }
  }
  return out;
}

export function entitledMemberModules(flags: Partial<TenantModuleFlags>): AssignableMemberModule[] {
  return MEMBERSHIP_ASSIGNABLE_MODULES.filter((m) => {
    const v = flags[m.entitlement];
    if (m.entitlement === "moduleListings") {
      return v !== false;
    }
    return Boolean(v);
  });
}

export function parseMembershipModulePermissionsFromForm(formData: FormData): MembershipModulePermissions {
  const out: MembershipModulePermissions = {};
  for (const mod of MEMBERSHIP_ASSIGNABLE_MODULES) {
    const raw = String(formData.get(`perm_${mod.key}`) || "").trim();
    if (!raw) continue;
    if (LEVELS.has(raw as MembershipModuleAccessLevel)) {
      out[mod.key] = raw as MembershipModuleAccessLevel;
    }
  }
  return out;
}

export function membershipModulePermissionsToJson(
  perms: MembershipModulePermissions,
): MembershipModulePermissions | null {
  const cleaned: MembershipModulePermissions = {};
  for (const [k, v] of Object.entries(perms)) {
    if (v && LEVELS.has(v)) cleaned[k as MembershipModuleKey] = v;
  }
  return Object.keys(cleaned).length ? cleaned : null;
}

export function getExplicitModuleLevel(
  perms: MembershipModulePermissions | null | undefined,
  moduleKey: MembershipModuleKey,
): MembershipModuleAccessLevel | null {
  return perms?.[moduleKey] ?? null;
}

export function memberCanAccessModuleNav(level: MembershipModuleAccessLevel | null): boolean {
  return level === "read" || level === "edit" || level === "full";
}

export function memberCanReadModule(level: MembershipModuleAccessLevel | null | "inherit"): boolean {
  if (level === "inherit" || level === null) return true;
  return memberCanAccessModuleNav(level);
}

export function memberCanEditModule(level: MembershipModuleAccessLevel | null | "inherit"): boolean {
  if (level === "inherit" || level === null) return true;
  return level === "edit" || level === "full";
}

export function memberCanCreateInModule(level: MembershipModuleAccessLevel | null | "inherit"): boolean {
  if (level === "inherit" || level === null) return true;
  return level === "full";
}

export function applyUserModulePermissionsToNavKeys(
  keys: TenantNavKey[],
  userPerms: MembershipModulePermissions | null | undefined,
  entitled: Partial<TenantModuleFlags>,
): TenantNavKey[] {
  if (!userPerms || !Object.keys(userPerms).length) return keys;

  const set = new Set(keys);
  for (const mod of entitledMemberModules(entitled)) {
    const level = userPerms[mod.key];
    if (!level) continue;
    if (level === "none") {
      for (const navKey of mod.navKeys) set.delete(navKey);
    } else if (memberCanAccessModuleNav(level)) {
      for (const navKey of mod.navKeys) set.add(navKey);
    }
  }

  const order: TenantNavKey[] = [
    "dashboard",
    "portal",
    "portalShortlets",
    "portalDocuments",
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
    "facility",
    "finance",
    "hr",
    "team",
    "settings",
  ];
  return order.filter((k) => set.has(k));
}
