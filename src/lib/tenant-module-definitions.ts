/** Shared module toggle definitions for platform admin + org settings. */
export type TenantModuleField =
  | "moduleSales"
  | "moduleFinance"
  | "moduleMarketing"
  | "moduleCommunity"
  | "moduleRealtorPortal"
  | "moduleShortLets"
  | "moduleHr"
  | "moduleTasks"
  | "moduleClients";

export type TenantModuleFlags = Record<TenantModuleField, boolean>;

export type TenantModuleDefinition = {
  key: TenantModuleField;
  label: string;
  description?: string;
  group: "core" | "people" | "real-estate";
  defaultOn: boolean;
};

export const TENANT_MODULE_DEFINITIONS: TenantModuleDefinition[] = [
  {
    key: "moduleSales",
    label: "Sales",
    description: "Dashboard, projects, leads, deals, activities",
    group: "core",
    defaultOn: true,
  },
  {
    key: "moduleFinance",
    label: "Finance",
    description: "Invoices, receipts, banking, reports",
    group: "core",
    defaultOn: true,
  },
  {
    key: "moduleMarketing",
    label: "Marketing",
    description: "Campaigns and lead sources",
    group: "core",
    defaultOn: true,
  },
  {
    key: "moduleCommunity",
    label: "Community",
    description: "Realtor partners and referrals",
    group: "core",
    defaultOn: true,
  },
  {
    key: "moduleRealtorPortal",
    label: "Realtor portal",
    description: "Partner self-serve portal",
    group: "core",
    defaultOn: true,
  },
  {
    key: "moduleTasks",
    label: "Tasks",
    description: "Company work boards and sprints",
    group: "core",
    defaultOn: true,
  },
  {
    key: "moduleHr",
    label: "People (HR)",
    description: "Employee profiles, payslips, documents",
    group: "people",
    defaultOn: false,
  },
  {
    key: "moduleClients",
    label: "Clients",
    description: "Property owners, units, client documents",
    group: "real-estate",
    defaultOn: false,
  },
  {
    key: "moduleShortLets",
    label: "Short lets",
    description: "Short-stay units and reservations",
    group: "real-estate",
    defaultOn: false,
  },
];

export function normalizeTenantModuleFlags(
  raw: Partial<TenantModuleFlags> | null | undefined,
): TenantModuleFlags {
  const out = {} as TenantModuleFlags;
  for (const def of TENANT_MODULE_DEFINITIONS) {
    out[def.key] = raw?.[def.key] ?? def.defaultOn;
  }
  return out;
}

export function readTenantModuleFlagsFromForm(formData: FormData): TenantModuleFlags {
  const out = {} as TenantModuleFlags;
  for (const def of TENANT_MODULE_DEFINITIONS) {
    out[def.key] = formData.get(def.key) === "on";
  }
  return out;
}

export function tenantModuleSummary(flags: Partial<TenantModuleFlags> | null | undefined): string {
  const normalized = normalizeTenantModuleFlags(flags);
  const enabled = TENANT_MODULE_DEFINITIONS.filter((d) => normalized[d.key]).map((d) => d.label);
  return enabled.length ? `${enabled.length} enabled` : "All off";
}

export const TENANT_MODULE_GROUPS: Array<{ id: TenantModuleDefinition["group"]; label: string }> = [
  { id: "core", label: "Core" },
  { id: "people", label: "People & HR" },
  { id: "real-estate", label: "Real estate" },
];
