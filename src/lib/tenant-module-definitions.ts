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
  | "moduleClients"
  | "moduleWhatsApp"
  | "moduleListings"
  | "moduleInvestorPortal";

export type TenantModuleFlags = Record<TenantModuleField, boolean>;

export type TenantModuleDefinition = {
  key: TenantModuleField;
  label: string;
  description?: string;
  /** Pages included when this module is enabled. */
  subpages: string[];
  group: "core" | "people" | "real-estate" | "growth";
  defaultOn: boolean;
  /** Only the platform admin can toggle this (plan / billing controlled). */
  platformOnly: boolean;
};

export const TENANT_MODULE_DEFINITIONS: TenantModuleDefinition[] = [
  {
    key: "moduleSales",
    label: "Sales",
    description: "CRM pipeline for developments and inventory sales",
    subpages: ["Dashboard", "Projects", "Leads", "Deals", "Activities"],
    group: "core",
    defaultOn: true,
    platformOnly: true,
  },
  {
    key: "moduleFinance",
    label: "Finance",
    description: "Invoices, receipts, banking, and finance reports",
    subpages: ["Finance workspace", "Documents", "Finance settings"],
    group: "core",
    defaultOn: true,
    platformOnly: true,
  },
  {
    key: "moduleMarketing",
    label: "Marketing",
    description: "Campaigns, lead sources, and capture forms",
    subpages: ["Marketing overview", "Lead forms", "Meta Lead Ads"],
    group: "core",
    defaultOn: true,
    platformOnly: true,
  },
  {
    key: "moduleCommunity",
    label: "Community",
    description: "Realtor partners, referrals, and partner payouts",
    subpages: ["Community workspace", "Partner roster", "Referral tracking"],
    group: "core",
    defaultOn: true,
    platformOnly: true,
  },
  {
    key: "moduleRealtorPortal",
    label: "Realtor portal",
    description: "Partner self-serve portal tokens and login links",
    subpages: ["Partner portal access", "Portal token rotation"],
    group: "core",
    defaultOn: true,
    platformOnly: true,
  },
  {
    key: "moduleTasks",
    label: "Tasks",
    description: "Company work boards, sprints, and assignments",
    subpages: ["Tasks board", "Spaces", "My work"],
    group: "core",
    defaultOn: true,
    platformOnly: true,
  },
  {
    key: "moduleHr",
    label: "People (HR)",
    description: "Employee profiles, payslips, and HR documents",
    subpages: ["HR dashboard", "Employee records", "Payslips", "HR queue"],
    group: "people",
    defaultOn: false,
    platformOnly: true,
  },
  {
    key: "moduleClients",
    label: "Clients",
    description: "Property owners, units, and client documents",
    subpages: ["Client directory", "Client profile", "Import clients"],
    group: "real-estate",
    defaultOn: false,
    platformOnly: true,
  },
  {
    key: "moduleShortLets",
    label: "Short lets (PMS)",
    description: "Short-stay property management",
    subpages: [
      "Front desk",
      "Room board",
      "Reservations",
      "Channels",
      "Guest bill",
      "Reports",
      "PMS settings",
    ],
    group: "real-estate",
    defaultOn: false,
    platformOnly: true,
  },
  {
    key: "moduleWhatsApp",
    label: "WhatsApp CRM + Bot",
    description: "Two-way WhatsApp inbox and auto-reply listings bot",
    subpages: ["WhatsApp inbox", "Lead WhatsApp", "Listings bot webhook"],
    group: "growth",
    defaultOn: true,
    platformOnly: true,
  },
  {
    key: "moduleListings",
    label: "Public listings (Explore)",
    description: "Branded Explore page, embed widget, and public listings API",
    subpages: ["Listings manager", "Explore page", "Embed widget"],
    group: "growth",
    defaultOn: true,
    platformOnly: true,
  },
  {
    key: "moduleInvestorPortal",
    label: "Investor portal",
    description: "Portfolio dashboards for investors and listing owners",
    subpages: ["My portfolio", "Stakeholders", "Project investor view"],
    group: "growth",
    defaultOn: false,
    platformOnly: true,
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
  { id: "growth", label: "Growth & channels" },
];

export function findTenantModuleDefinition(key: TenantModuleField): TenantModuleDefinition | undefined {
  return TENANT_MODULE_DEFINITIONS.find((d) => d.key === key);
}
