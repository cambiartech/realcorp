import { MembershipRole } from "@/generated/prisma";

/** Core org departments — invite UI and visibility are built on these. */
export type OrgDepartment = "sales" | "finance" | "marketing" | "community" | "hr" | "operations";

export const ORG_DEPARTMENT_OPTIONS: { value: OrgDepartment; label: string }[] = [
  { value: "sales", label: "Sales" },
  { value: "finance", label: "Finance" },
  { value: "marketing", label: "Marketing" },
  { value: "community", label: "Community" },
  { value: "hr", label: "People (HR)" },
  { value: "operations", label: "Operations / Short lets" },
];

export type DashboardRoleView =
  | "ORG_ADMIN"
  | "FINANCE"
  | "SALES_MANAGER"
  | "SALES"
  | "HR"
  | "MARKETING"
  | "COMMUNITY"
  | "OPERATIONS";

export type MembershipProfileInput =
  | { kind: "org_admin" }
  | { kind: "department"; department: OrgDepartment; isDepartmentLead: boolean }
  | { kind: "portal"; portalRole: "investor" | "listing_owner" };

export function resolveMembershipRole(input: MembershipProfileInput): MembershipRole {
  if (input.kind === "org_admin") return MembershipRole.ORG_ADMIN;
  if (input.kind === "portal") {
    return input.portalRole === "listing_owner"
      ? MembershipRole.LISTING_OWNER
      : MembershipRole.INVESTOR;
  }
  const { department, isDepartmentLead } = input;
  switch (department) {
    case "sales":
      return isDepartmentLead ? MembershipRole.SALES_MANAGER : MembershipRole.SALES_EXECUTIVE;
    case "finance":
      return MembershipRole.FINANCE_MANAGER;
    case "marketing":
      return MembershipRole.MARKETING_MANAGER;
    case "community":
      return MembershipRole.COMMUNITY_MANAGER;
    case "hr":
      return MembershipRole.HR_MANAGER;
    case "operations":
      return isDepartmentLead ? MembershipRole.HOUSEKEEPING_MANAGER : MembershipRole.FNB_STAFF;
    default:
      return MembershipRole.SALES_EXECUTIVE;
  }
}

export function profileFromMembershipRole(role: MembershipRole): {
  department: OrgDepartment | null;
  isDepartmentLead: boolean;
} {
  switch (role) {
    case MembershipRole.ORG_ADMIN:
      return { department: null, isDepartmentLead: true };
    case MembershipRole.SALES_MANAGER:
      return { department: "sales", isDepartmentLead: true };
    case MembershipRole.SALES_EXECUTIVE:
      return { department: "sales", isDepartmentLead: false };
    case MembershipRole.FINANCE_MANAGER:
      return { department: "finance", isDepartmentLead: true };
    case MembershipRole.MARKETING_MANAGER:
      return { department: "marketing", isDepartmentLead: true };
    case MembershipRole.COMMUNITY_MANAGER:
      return { department: "community", isDepartmentLead: true };
    case MembershipRole.HR_MANAGER:
      return { department: "hr", isDepartmentLead: true };
    case MembershipRole.HOUSEKEEPING_MANAGER:
      return { department: "operations", isDepartmentLead: true };
    case MembershipRole.FNB_STAFF:
      return { department: "operations", isDepartmentLead: false };
    default:
      return { department: null, isDepartmentLead: false };
  }
}

export function membershipRoleLabel(role: MembershipRole, department?: string | null, isDepartmentLead?: boolean) {
  if (role === MembershipRole.ORG_ADMIN) return "Organization admin";
  if (role === MembershipRole.INVESTOR) return "Investor (portal)";
  if (role === MembershipRole.LISTING_OWNER) return "Listing owner (portal)";

  const dept = (department as OrgDepartment | null) ?? profileFromMembershipRole(role).department;
  const lead = isDepartmentLead ?? profileFromMembershipRole(role).isDepartmentLead;
  const deptLabel = ORG_DEPARTMENT_OPTIONS.find((d) => d.value === dept)?.label ?? "Team member";
  return lead ? `${deptLabel} · Lead` : deptLabel;
}

export function normalizeLegacyDashboardRoleView(value?: string | null): DashboardRoleView | null {
  if (!value) return null;
  if (value === "FINANCE_MANAGER") return "FINANCE";
  if (value === "SALES_EXECUTIVE") return "SALES";
  const all: DashboardRoleView[] = [
    "ORG_ADMIN",
    "FINANCE",
    "SALES_MANAGER",
    "SALES",
    "HR",
    "MARKETING",
    "COMMUNITY",
    "OPERATIONS",
  ];
  return all.includes(value as DashboardRoleView) ? (value as DashboardRoleView) : null;
}

export function dashboardRoleViewForMembership(
  role: MembershipRole,
  opts?: { isPlatformAdmin?: boolean; department?: string | null; isDepartmentLead?: boolean },
): DashboardRoleView {
  if (opts?.isPlatformAdmin || role === MembershipRole.ORG_ADMIN) return "ORG_ADMIN";

  const dept = (opts?.department as OrgDepartment | null) ?? profileFromMembershipRole(role).department;
  const lead = opts?.isDepartmentLead ?? profileFromMembershipRole(role).isDepartmentLead;

  if (dept === "finance" || role === MembershipRole.FINANCE_MANAGER) return "FINANCE";
  if (dept === "hr" || role === MembershipRole.HR_MANAGER) return "HR";
  if (dept === "marketing" || role === MembershipRole.MARKETING_MANAGER) return "MARKETING";
  if (dept === "community" || role === MembershipRole.COMMUNITY_MANAGER) return "COMMUNITY";
  if (
    dept === "operations" ||
    role === MembershipRole.HOUSEKEEPING_MANAGER ||
    role === MembershipRole.FNB_STAFF
  ) {
    return "OPERATIONS";
  }
  if (dept === "sales" || role === MembershipRole.SALES_MANAGER || role === MembershipRole.SALES_EXECUTIVE) {
    return lead || role === MembershipRole.SALES_MANAGER ? "SALES_MANAGER" : "SALES";
  }

  return "SALES";
}

export function dashboardShowsSalesKpis(view: DashboardRoleView): boolean {
  return view === "ORG_ADMIN" || view === "SALES_MANAGER" || view === "SALES";
}

export function dashboardShowsFinanceKpis(view: DashboardRoleView): boolean {
  return view === "ORG_ADMIN" || view === "FINANCE";
}

/** Sales integrations & org provisioning — org admin and sales leadership only. */
export function dashboardShowsSetupIntegrations(view: DashboardRoleView): boolean {
  return view === "ORG_ADMIN" || view === "SALES_MANAGER";
}

export function dashboardShowsHrPeoplePanel(view: DashboardRoleView, moduleHr: boolean): boolean {
  return moduleHr && view === "HR";
}

export const DASHBOARD_ROLE_VIEW_LABELS: Record<DashboardRoleView, string> = {
  ORG_ADMIN: "Organization admin",
  FINANCE: "Finance",
  SALES_MANAGER: "Sales · Lead",
  SALES: "Sales",
  HR: "People (HR)",
  MARKETING: "Marketing",
  COMMUNITY: "Community",
  OPERATIONS: "Operations",
};
