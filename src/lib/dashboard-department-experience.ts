import type { DashboardRoleView } from "@/lib/org-membership-profile";

export type DepartmentOverviewKind =
  | "org_sales_setup"
  | "hr_people"
  | "finance_queue"
  | "marketing_pipeline"
  | "community_engagement"
  | "operations_floor";

export type DashboardQuickAction =
  | { type: "link"; label: string; href: string }
  | { type: "button"; label: string; action: "filters" | "saved_views" | "setup_guide" };

const OVERVIEW_LABELS: Record<DepartmentOverviewKind, string> = {
  org_sales_setup: "setup & integrations",
  hr_people: "people overview",
  finance_queue: "finance queue",
  marketing_pipeline: "campaigns & leads",
  community_engagement: "community pulse",
  operations_floor: "operations snapshot",
};

export function departmentOverviewKind(
  view: DashboardRoleView,
  hrModuleEnabled: boolean,
): DepartmentOverviewKind | null {
  switch (view) {
    case "ORG_ADMIN":
    case "SALES_MANAGER":
      return "org_sales_setup";
    case "HR":
      return hrModuleEnabled ? "hr_people" : null;
    case "FINANCE":
      return "finance_queue";
    case "MARKETING":
      return "marketing_pipeline";
    case "COMMUNITY":
      return "community_engagement";
    case "OPERATIONS":
      return "operations_floor";
    default:
      return null;
  }
}

export function departmentOverviewToggleLabel(kind: DepartmentOverviewKind | null): string | null {
  if (!kind) return null;
  return OVERVIEW_LABELS[kind];
}

export function departmentQuickActions(
  view: DashboardRoleView,
  tenantSlug: string,
  opts: { canManageOrgSetup: boolean; hrModuleEnabled: boolean },
): DashboardQuickAction[] {
  const base = `/${tenantSlug}`;

  switch (view) {
    case "HR":
      return [
        { type: "link", label: "HR workspace", href: `${base}/hr` },
        { type: "link", label: "People directory", href: `${base}/hr?tab=people` },
        { type: "link", label: "Appraisals", href: `${base}/hr?tab=appraisals` },
        { type: "link", label: "Tasks board", href: `${base}/tasks` },
      ];
    case "FINANCE":
      return [
        { type: "link", label: "Finance workspace", href: `${base}/finance` },
        { type: "link", label: "Record payment", href: `${base}/finance` },
        { type: "link", label: "Invoices & receipts", href: `${base}/finance` },
        { type: "button", label: "Dashboard filters", action: "filters" },
      ];
    case "MARKETING":
      return [
        { type: "link", label: "Marketing hub", href: `${base}/marketing` },
        { type: "link", label: "Lead sources", href: `${base}/leads` },
        { type: "link", label: "Import leads", href: `${base}/leads/import` },
        { type: "link", label: "Tasks board", href: `${base}/tasks` },
      ];
    case "COMMUNITY":
      return [
        { type: "link", label: "Community hub", href: `${base}/community` },
        { type: "link", label: "Tasks board", href: `${base}/tasks` },
        { type: "link", label: "Team directory", href: `${base}/team` },
        { type: "button", label: "Dashboard filters", action: "filters" },
      ];
    case "OPERATIONS":
      return [
        { type: "link", label: "Tasks board", href: `${base}/tasks` },
        { type: "link", label: "Short lets", href: `${base}/shortlets` },
        { type: "link", label: "Projects", href: `${base}/projects` },
        { type: "button", label: "Dashboard filters", action: "filters" },
      ];
    case "SALES":
      return [
        { type: "link", label: "My pipeline", href: `${base}/deals` },
        { type: "link", label: "New lead", href: `${base}/leads` },
        { type: "link", label: "Tasks board", href: `${base}/tasks?view=my` },
        { type: "button", label: "Dashboard filters", action: "filters" },
      ];
    case "SALES_MANAGER":
      return [
        { type: "link", label: "Team pipeline", href: `${base}/deals` },
        { type: "link", label: "Unassigned leads", href: `${base}/leads` },
        { type: "link", label: "Import leads", href: `${base}/leads/import` },
        ...(opts.canManageOrgSetup
          ? [{ type: "button" as const, label: "Setup guide", action: "setup_guide" as const }]
          : []),
      ];
    case "ORG_ADMIN":
      return [
        { type: "link", label: "Team & invites", href: `${base}/team` },
        { type: "link", label: "Integrations", href: `${base}/settings?tab=integrations` },
        { type: "link", label: "Finance workspace", href: `${base}/finance` },
        ...(opts.canManageOrgSetup
          ? [{ type: "button" as const, label: "Setup guide", action: "setup_guide" as const }]
          : []),
      ];
    default:
      return [{ type: "button", label: "Dashboard filters", action: "filters" }];
  }
}
