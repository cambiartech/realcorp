"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { formatEnumLabel } from "@/lib/ui-format";
import { saveDashboardPreference, upsertTenantGoal } from "./actions";

type RoleView = "ORG_ADMIN" | "FINANCE_MANAGER" | "SALES_MANAGER" | "SALES_EXECUTIVE";

type WidgetValue = {
  revenueMtd: number;
  pipelineOpen: number;
  pendingFinanceCount: number;
  reservedUnits: number;
  soldUnits: number;
  availableUnits: number;
  expectedThisMonth: number;
  overdueAmount: number;
  overdueCount: number;
  pendingVerificationCount: number;
  invoicesMtdCount: number;
  teamPipelineCount: number;
  unassignedLeads: number;
  myPipelineCount: number;
  myNewLeads7d: number;
  leadFunnel: Array<{ stage: string; count: number }>;
  leaderboard: Array<{ label: string; value: number }>;
  stageVelocity: Array<{ stage: string; avgDays: number; dropOffPct: number }>;
  leadSourceQuality: Array<{ source: string; leads: number; wonDeals: number; winRate: number; wonValue: number }>;
  topProjectsIntelligence: Array<{ project: string; leads: number; dealValue: number; conversionRate: number }>;
  repLeaderboardTrend: Array<{ label: string; current: number; previous: number; deltaPct: number }>;
  onboarding: {
    connectIntegrationDone: boolean;
    importedLeadsDone: boolean;
    createdDealDone: boolean;
    followUpSentDone: boolean;
    firstTaskDone: boolean;
  };
  hrOnboarding:
    | { state: "none"; hrDashboardUrl: string }
    | {
        state: "pending";
        pendingCount: number;
        sectionLabels: string[];
        dueLabel: string | null;
        masterUrl: string | null;
        hrDashboardUrl: string;
      }
    | {
        state: "complete";
        submittedCount: number;
        submittedAtLabel: string;
        viewUrl: string | null;
        hrDashboardUrl: string;
      };
  integrationHealth: {
    metaLeads: boolean;
    whatsapp: boolean;
    sms: boolean;
    inboundWebhookLastAt: string | null;
  };
  revenueMonthly: Array<{ label: string; month: number; year: number; value: number }>;
  pipelineVsTargetMonthly: Array<{ label: string; month: number; year: number; pipeline: number; target: number }>;
  revenueWeekly: Array<{ label: string; value: number }>;
  pipelineVsTargetWeekly: Array<{ label: string; pipeline: number; target: number }>;
  kpiLeadRows: Array<{
    id: string;
    createdAt: string;
    ownerId: string | null;
    ownerLabel: string;
    source: string;
    projectInterest: string;
    name: string;
  }>;
  kpiDealRows: Array<{
    id: string;
    createdAt: string;
    ownerId: string | null;
    ownerLabel: string;
    stage: string;
    value: number;
    projectId: string | null;
    projectName: string;
  }>;
  kpiProjectRows: Array<{
    id: string;
    name: string;
    createdAt: string;
  }>;
  kpiInvoiceRows: Array<{
    id: string;
    invoiceNumber: string;
    createdAt: string;
    issuedAt: string;
    dueDate: string | null;
    status: string;
    amount: number;
    balanceDue: number;
    currency: string;
    ownerId: string | null;
    ownerLabel: string;
    projectId: string | null;
    projectName: string;
  }>;
  kpiPaymentRows: Array<{
    id: string;
    invoiceId: string;
    invoiceNumber: string;
    paidAt: string;
    amount: number;
    currency: string;
    method: string;
    reference: string;
    ownerId: string | null;
    ownerLabel: string;
    projectId: string | null;
    projectName: string;
    recordedByLabel: string;
  }>;
  filterOptions: {
    owners: Array<{ id: string; label: string }>;
    projects: Array<{ id: string; label: string }>;
    leadSources: string[];
  };
};

type Goal = {
  label: string;
  fiscalYearStart: string;
  fiscalYearEnd: string;
  revenueTarget: number | null;
  pipelineTarget: number | null;
} | null;

type FilterPreset = {
  id: string;
  label: string;
  range: "TODAY" | "WEEK" | "1M" | "6M" | "12M" | "YTD";
  module: "ALL" | "SALES" | "FINANCE" | "PROJECTS";
  owner: string;
  project: string;
  source: string;
};

const WIDGET_LABELS: Record<string, string> = {
  revenue_target_progress: "Collections vs fiscal target (MTD)",
  pipeline_target_progress: "Pipeline vs fiscal target",
  pending_finance_count: "Pending finance queue",
  inventory_snapshot: "Inventory snapshot",
  sales_leaderboard: "Sales leaderboard",
  lead_funnel: "Lead funnel snapshot",
  stage_velocity_dropoff: "Stage velocity + drop-off",
  lead_source_quality: "Lead source quality",
  top_projects_intel: "Top projects intelligence",
  rep_leaderboard_trend: "Rep leaderboard trend",
  revenue_monthly_bar: "Collections by period",
  pipeline_target_trend: "Pipeline vs target trend",
  expected_month: "Expected this month",
  overdue_installments: "Overdue installments",
  pending_verification: "Pending verification queue",
  recent_payments: "Receipts / invoices this month",
  team_pipeline: "Team pipeline summary",
  unassigned_leads: "Unassigned leads",
  my_pipeline: "My pipeline",
  my_new_leads: "My new leads (7d)",
};

const ROLE_WIDGETS: Record<RoleView, string[]> = {
  ORG_ADMIN: [
    "revenue_target_progress",
    "pipeline_target_progress",
    "pending_finance_count",
    "revenue_monthly_bar",
    "pipeline_target_trend",
    "inventory_snapshot",
    "sales_leaderboard",
    "lead_funnel",
    "stage_velocity_dropoff",
    "lead_source_quality",
    "top_projects_intel",
    "rep_leaderboard_trend",
  ],
  FINANCE_MANAGER: [
    "expected_month",
    "overdue_installments",
    "pending_verification",
    "recent_payments",
    "pending_finance_count",
  ],
  SALES_MANAGER: [
    "team_pipeline",
    "unassigned_leads",
    "lead_funnel",
    "pending_finance_count",
    "stage_velocity_dropoff",
    "lead_source_quality",
    "top_projects_intel",
    "rep_leaderboard_trend",
  ],
  SALES_EXECUTIVE: ["my_pipeline", "my_new_leads", "lead_funnel"],
};

const ALL_WIDGET_IDS = new Set(Object.values(ROLE_WIDGETS).flat());

const DASHBOARD_UI_DRAFT_VERSION = 1;

type DashboardUiDraftV1 = {
  v: number;
  roleView: RoleView;
  widgetIds: string[];
  chartRange: "WEEK" | "1M" | "6M" | "12M" | "YTD";
  globalRange: FilterPreset["range"];
  module: FilterPreset["module"];
  owner: string;
  project: string;
  source: string;
};

function dashboardDraftKey(tenantSlug: string) {
  return `dashboard-ui-draft:${tenantSlug}`;
}

function sanitizeWidgetIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.filter((x): x is string => typeof x === "string" && ALL_WIDGET_IDS.has(x));
}

function readDashboardDraft(tenantSlug: string): DashboardUiDraftV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(dashboardDraftKey(tenantSlug));
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<DashboardUiDraftV1>;
    if (d.v !== DASHBOARD_UI_DRAFT_VERSION || !d.roleView) return null;
    const allowedRole: RoleView[] = ["ORG_ADMIN", "FINANCE_MANAGER", "SALES_MANAGER", "SALES_EXECUTIVE"];
    if (!allowedRole.includes(d.roleView)) return null;
    const widgetIds = sanitizeWidgetIds(d.widgetIds);
    return {
      v: DASHBOARD_UI_DRAFT_VERSION,
      roleView: d.roleView,
      widgetIds,
      chartRange:
        d.chartRange === "WEEK" || d.chartRange === "1M" || d.chartRange === "6M" || d.chartRange === "12M" || d.chartRange === "YTD"
          ? d.chartRange
          : "1M",
      globalRange:
        d.globalRange === "TODAY" ||
        d.globalRange === "WEEK" ||
        d.globalRange === "1M" ||
        d.globalRange === "6M" ||
        d.globalRange === "12M" ||
        d.globalRange === "YTD"
          ? d.globalRange
          : "1M",
      module:
        d.module === "ALL" || d.module === "SALES" || d.module === "FINANCE" || d.module === "PROJECTS" ? d.module : "ALL",
      owner: typeof d.owner === "string" ? d.owner : "",
      project: typeof d.project === "string" ? d.project : "",
      source: typeof d.source === "string" ? d.source : "",
    };
  } catch {
    return null;
  }
}

function writeDashboardDraft(tenantSlug: string, draft: DashboardUiDraftV1) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(dashboardDraftKey(tenantSlug), JSON.stringify(draft));
  } catch {
    // ignore quota / private mode
  }
}

type DashboardBootstrapUi = {
  roleView: RoleView;
  selectedWidgets: string[];
  chartRange: "WEEK" | "1M" | "6M" | "12M" | "YTD";
  globalRange: FilterPreset["range"];
  module: FilterPreset["module"];
  owner: string;
  project: string;
  source: string;
};

/** SSR/client first paint — must not read localStorage or widgets will not match the server HTML. */
function getServerAlignedDashboardUi(initialRoleView: RoleView, initialWidgetIds: string[]): DashboardBootstrapUi {
  const defaultForRole = ROLE_WIDGETS[initialRoleView];
  const mergedInitial = Array.from(
    new Set<string>([
      ...(initialWidgetIds.length ? initialWidgetIds : defaultForRole),
      "revenue_monthly_bar",
      "pipeline_target_trend",
    ]),
  );
  return {
    roleView: initialRoleView,
    selectedWidgets: mergedInitial,
    chartRange: "1M",
    globalRange: "1M",
    module: "ALL",
    owner: "",
    project: "",
    source: "",
  };
}

function mergeDashboardDraftFromStorage(
  tenantSlug: string,
  roleViewOptions: readonly RoleView[],
  initialRoleView: RoleView,
): DashboardBootstrapUi | null {
  const d = readDashboardDraft(tenantSlug);
  if (!d) return null;
  const rv = roleViewOptions.includes(d.roleView) ? d.roleView : initialRoleView;
  const pool = ROLE_WIDGETS[rv];
  const poolSet = new Set(pool);
  let nextIds = d.widgetIds.length > 0 ? d.widgetIds.filter((id) => poolSet.has(id)) : [...pool];
  if (nextIds.length === 0) nextIds = [...pool];
  return {
    roleView: rv,
    selectedWidgets: nextIds,
    chartRange: d.chartRange,
    globalRange: d.globalRange,
    module: d.module,
    owner: d.owner,
    project: d.project,
    source: d.source,
  };
}

export function DashboardWorkspace({
  tenantSlug,
  tenantName,
  roleViewOptions,
  initialRoleView,
  initialWidgetIds,
  values,
  goal,
  canManageGoals,
}: {
  tenantSlug: string;
  tenantName: string;
  roleViewOptions: readonly RoleView[];
  initialRoleView: RoleView;
  initialWidgetIds: string[];
  values: WidgetValue;
  goal: Goal;
  canManageGoals: boolean;
}) {
  const initialUi = useMemo(
    () => getServerAlignedDashboardUi(initialRoleView, initialWidgetIds),
    [initialRoleView, initialWidgetIds],
  );

  const [roleView, setRoleView] = useState<RoleView>(initialUi.roleView);
  const [selectedWidgets, setSelectedWidgets] = useState<string[]>(initialUi.selectedWidgets);
  const [openBuilder, setOpenBuilder] = useState(false);
  const [openGoal, setOpenGoal] = useState(false);
  const [pending, setPending] = useState(false);
  const [chartRange, setChartRange] = useState<"WEEK" | "1M" | "6M" | "12M" | "YTD">(initialUi.chartRange);
  const [globalRange, setGlobalRange] = useState<"TODAY" | "WEEK" | "1M" | "6M" | "12M" | "YTD">(initialUi.globalRange);
  const [moduleFilter, setModuleFilter] = useState<"ALL" | "SALES" | "FINANCE" | "PROJECTS">(initialUi.module);
  const [ownerFilter, setOwnerFilter] = useState(initialUi.owner);
  const [projectFilter, setProjectFilter] = useState(initialUi.project);
  const [sourceFilter, setSourceFilter] = useState(initialUi.source);
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>([]);

  const draftBootstrapRef = useRef({ roleViewOptions, initialRoleView });
  draftBootstrapRef.current = { roleViewOptions, initialRoleView };

  useEffect(() => {
    const { roleViewOptions: rvo, initialRoleView: irv } = draftBootstrapRef.current;
    const fromDraft = mergeDashboardDraftFromStorage(tenantSlug, rvo, irv);
    if (!fromDraft) return;
    setRoleView(fromDraft.roleView);
    setSelectedWidgets(fromDraft.selectedWidgets);
    setChartRange(fromDraft.chartRange);
    setGlobalRange(fromDraft.globalRange);
    setModuleFilter(fromDraft.module);
    setOwnerFilter(fromDraft.owner);
    setProjectFilter(fromDraft.project);
    setSourceFilter(fromDraft.source);
  }, [tenantSlug]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`dashboard-filter-presets:${tenantSlug}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as FilterPreset[];
      if (Array.isArray(parsed)) setFilterPresets(parsed.slice(0, 12));
    } catch {
      // ignore
    }
  }, [tenantSlug]);
  const [presetDraftName, setPresetDraftName] = useState("");
  const [openFabMenu, setOpenFabMenu] = useState(false);
  const [openScopeFilters, setOpenScopeFilters] = useState(false);
  const [openSavedViews, setOpenSavedViews] = useState(false);
  const [openOnboardingGuide, setOpenOnboardingGuide] = useState(false);
  const [showSetupPanel, setShowSetupPanel] = useState(false);
  const [openKpiDetail, setOpenKpiDetail] = useState<null | "LEADS_TODAY" | "DEALS_TODAY" | "PROJECTS" | "TOP_PROJECTS">(null);
  const [openFinanceDetail, setOpenFinanceDetail] = useState<
    null | "COLLECTIONS_TREND" | "OVERDUE_AGING" | "HEALTH_PROJECT_TEAM" | "TARGET_ATTAINMENT"
  >(null);
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const widgetPool = useMemo(() => ROLE_WIDGETS[roleView], [roleView]);
  const enabledWidgets = useMemo(
    () => selectedWidgets.filter((id) => widgetPool.includes(id)),
    [selectedWidgets, widgetPool],
  );
  const widgetOrder = useMemo(() => {
    const map = new Map(widgetPool.map((id, idx) => [id, idx]));
    return enabledWidgets.slice().sort((a, b) => (map.get(a) ?? 999) - (map.get(b) ?? 999));
  }, [enabledWidgets, widgetPool]);

  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      writeDashboardDraft(tenantSlug, {
        v: DASHBOARD_UI_DRAFT_VERSION,
        roleView,
        widgetIds: selectedWidgets,
        chartRange,
        globalRange,
        module: moduleFilter,
        owner: ownerFilter,
        project: projectFilter,
        source: sourceFilter,
      });
    }, 400);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [
    tenantSlug,
    roleView,
    selectedWidgets,
    chartRange,
    globalRange,
    moduleFilter,
    ownerFilter,
    projectFilter,
    sourceFilter,
  ]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const seriesRevenue = useMemo(() => {
    if (chartRange === "WEEK") return values.revenueWeekly.slice(-8);
    if (chartRange === "1M") return values.revenueWeekly.slice(-4);
    if (chartRange === "12M") return values.revenueMonthly;
    if (chartRange === "YTD") return values.revenueMonthly.filter((x) => x.year === currentYear);
    return values.revenueMonthly.slice(-6);
  }, [chartRange, values.revenueMonthly, values.revenueWeekly, currentYear]);
  const seriesPipeline = useMemo(() => {
    if (chartRange === "WEEK") return values.pipelineVsTargetWeekly.slice(-8);
    if (chartRange === "1M") return values.pipelineVsTargetWeekly.slice(-4);
    if (chartRange === "12M") return values.pipelineVsTargetMonthly;
    if (chartRange === "YTD") return values.pipelineVsTargetMonthly.filter((x) => x.year === currentYear);
    return values.pipelineVsTargetMonthly.slice(-6);
  }, [
    chartRange,
    values.pipelineVsTargetMonthly,
    values.pipelineVsTargetWeekly,
    currentYear,
  ]);

  const rangeStart = useMemo(() => {
    const nowDate = new Date();
    const start = new Date(nowDate);
    start.setHours(0, 0, 0, 0);
    if (globalRange === "TODAY") return start;
    if (globalRange === "WEEK") {
      const day = start.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      start.setDate(start.getDate() + diff);
      return start;
    }
    if (globalRange === "1M") {
      start.setMonth(start.getMonth() - 1);
      return start;
    }
    if (globalRange === "6M") {
      start.setMonth(start.getMonth() - 6);
      return start;
    }
    if (globalRange === "12M") {
      start.setMonth(start.getMonth() - 12);
      return start;
    }
    start.setMonth(0, 1);
    return start;
  }, [globalRange]);

  const filteredLeads = useMemo(() => {
    return values.kpiLeadRows.filter((row) => {
      const created = new Date(row.createdAt);
      if (created < rangeStart) return false;
      if (ownerFilter && row.ownerId !== ownerFilter) return false;
      if (sourceFilter && row.source !== sourceFilter) return false;
      if (projectFilter && row.projectInterest !== values.filterOptions.projects.find((p) => p.id === projectFilter)?.label)
        return false;
      if (moduleFilter !== "ALL" && moduleFilter !== "SALES") return false;
      return true;
    });
  }, [values.kpiLeadRows, values.filterOptions.projects, rangeStart, ownerFilter, sourceFilter, projectFilter, moduleFilter]);

  const filteredDeals = useMemo(() => {
    return values.kpiDealRows.filter((row) => {
      const created = new Date(row.createdAt);
      if (created < rangeStart) return false;
      if (ownerFilter && row.ownerId !== ownerFilter) return false;
      if (projectFilter && row.projectId !== projectFilter) return false;
      if (moduleFilter !== "ALL" && moduleFilter !== "SALES" && moduleFilter !== "FINANCE") return false;
      return true;
    });
  }, [values.kpiDealRows, rangeStart, ownerFilter, projectFilter, moduleFilter]);

  const filteredProjects = useMemo(() => {
    return values.kpiProjectRows.filter((row) => {
      const created = new Date(row.createdAt);
      if (created < rangeStart) return false;
      if (projectFilter && row.id !== projectFilter) return false;
      if (moduleFilter !== "ALL" && moduleFilter !== "PROJECTS") return false;
      return true;
    });
  }, [values.kpiProjectRows, rangeStart, projectFilter, moduleFilter]);

  const filteredFinanceInvoices = useMemo(() => {
    return values.kpiInvoiceRows.filter((row) => {
      const created = new Date(row.createdAt);
      if (created < rangeStart) return false;
      if (ownerFilter && row.ownerId !== ownerFilter) return false;
      if (projectFilter && row.projectId !== projectFilter) return false;
      if (moduleFilter !== "ALL" && moduleFilter !== "FINANCE") return false;
      return true;
    });
  }, [values.kpiInvoiceRows, rangeStart, ownerFilter, projectFilter, moduleFilter]);

  const filteredFinancePayments = useMemo(() => {
    return values.kpiPaymentRows.filter((row) => {
      const paid = new Date(row.paidAt);
      if (paid < rangeStart) return false;
      if (ownerFilter && row.ownerId !== ownerFilter) return false;
      if (projectFilter && row.projectId !== projectFilter) return false;
      if (moduleFilter !== "ALL" && moduleFilter !== "FINANCE") return false;
      return true;
    });
  }, [values.kpiPaymentRows, rangeStart, ownerFilter, projectFilter, moduleFilter]);

  const collectionsTrend = useMemo(() => {
    const out: Array<{ label: string; invoiced: number; collected: number; outstanding: number }> = [];
    for (let i = 5; i >= 0; i -= 1) {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      start.setMonth(start.getMonth() - i);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      const invoiced = filteredFinanceInvoices
        .filter((x) => new Date(x.issuedAt) >= start && new Date(x.issuedAt) < end && x.status !== "VOID")
        .reduce((sum, x) => sum + x.amount, 0);
      const collected = filteredFinancePayments
        .filter((x) => new Date(x.paidAt) >= start && new Date(x.paidAt) < end)
        .reduce((sum, x) => sum + x.amount, 0);
      const outstanding = filteredFinanceInvoices
        .filter((x) => x.status !== "VOID" && x.status !== "PAID")
        .reduce((sum, x) => sum + x.balanceDue, 0);
      out.push({
        label: start.toLocaleDateString("en-NG", { month: "short" }),
        invoiced,
        collected,
        outstanding,
      });
    }
    return out;
  }, [filteredFinanceInvoices, filteredFinancePayments]);

  const overdueAging = useMemo(() => {
    const now = new Date();
    const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90p: 0, noDueDate: 0 };
    for (const invoice of filteredFinanceInvoices) {
      if (invoice.status === "VOID" || invoice.status === "PAID" || invoice.balanceDue <= 0) continue;
      if (!invoice.dueDate) {
        buckets.noDueDate += invoice.balanceDue;
        continue;
      }
      const due = new Date(invoice.dueDate);
      const overdueDays = Math.floor((now.getTime() - due.getTime()) / 86_400_000);
      if (overdueDays <= 0) buckets.current += invoice.balanceDue;
      else if (overdueDays <= 30) buckets.d1_30 += invoice.balanceDue;
      else if (overdueDays <= 60) buckets.d31_60 += invoice.balanceDue;
      else if (overdueDays <= 90) buckets.d61_90 += invoice.balanceDue;
      else buckets.d90p += invoice.balanceDue;
    }
    return buckets;
  }, [filteredFinanceInvoices]);

  const financeHealthRows = useMemo(() => {
    const byProject = new Map<string, { label: string; invoiced: number; collected: number; outstanding: number }>();
    const byOwner = new Map<string, { label: string; invoiced: number; collected: number; outstanding: number }>();
    for (const i of filteredFinanceInvoices) {
      const pKey = i.projectId || "none";
      const oKey = i.ownerId || "none";
      const p = byProject.get(pKey) || { label: i.projectName, invoiced: 0, collected: 0, outstanding: 0 };
      p.invoiced += i.amount;
      p.outstanding += i.balanceDue;
      byProject.set(pKey, p);
      const o = byOwner.get(oKey) || { label: i.ownerLabel, invoiced: 0, collected: 0, outstanding: 0 };
      o.invoiced += i.amount;
      o.outstanding += i.balanceDue;
      byOwner.set(oKey, o);
    }
    for (const p of filteredFinancePayments) {
      const pKey = p.projectId || "none";
      const oKey = p.ownerId || "none";
      const pb = byProject.get(pKey) || { label: p.projectName, invoiced: 0, collected: 0, outstanding: 0 };
      pb.collected += p.amount;
      byProject.set(pKey, pb);
      const ob = byOwner.get(oKey) || { label: p.ownerLabel, invoiced: 0, collected: 0, outstanding: 0 };
      ob.collected += p.amount;
      byOwner.set(oKey, ob);
    }
    return {
      projects: Array.from(byProject.values()).sort((a, b) => b.outstanding - a.outstanding).slice(0, 8),
      owners: Array.from(byOwner.values()).sort((a, b) => b.outstanding - a.outstanding).slice(0, 8),
    };
  }, [filteredFinanceInvoices, filteredFinancePayments]);

  const fiscalAttainment = useMemo(() => {
    if (!goal) return { periods: [] as Array<{ period: string; actual: number; target: number; attainmentPct: number }> };
    const start = new Date(goal.fiscalYearStart);
    const end = new Date(goal.fiscalYearEnd);
    const totalMonths = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);
    const periodTarget = goal.revenueTarget ? goal.revenueTarget / totalMonths : 0;
    const periods: Array<{ period: string; actual: number; target: number; attainmentPct: number }> = [];
    for (let i = 0; i < totalMonths; i += 1) {
      const periodStart = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      const actual = filteredFinancePayments
        .filter((x) => new Date(x.paidAt) >= periodStart && new Date(x.paidAt) < periodEnd)
        .reduce((sum, x) => sum + x.amount, 0);
      const attainmentPct = periodTarget > 0 ? (actual / periodTarget) * 100 : 0;
      periods.push({
        period: periodStart.toLocaleDateString("en-NG", { month: "short", year: "numeric" }),
        actual,
        target: periodTarget,
        attainmentPct: Number(attainmentPct.toFixed(1)),
      });
    }
    return { periods };
  }, [goal, filteredFinancePayments]);

  const leadsTodayCount = useMemo(() => {
    const today = new Date();
    return filteredLeads.filter((r) => {
      const d = new Date(r.createdAt);
      return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
    }).length;
  }, [filteredLeads]);

  const dealsTodayCount = useMemo(() => {
    const today = new Date();
    return filteredDeals.filter((r) => {
      const d = new Date(r.createdAt);
      return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
    }).length;
  }, [filteredDeals]);

  const topProjects = useMemo(() => {
    const map = new Map<string, { projectId: string | null; projectName: string; dealCount: number; totalValue: number }>();
    for (const deal of filteredDeals) {
      const key = deal.projectId || "no-project";
      const curr = map.get(key) || { projectId: deal.projectId, projectName: deal.projectName, dealCount: 0, totalValue: 0 };
      curr.dealCount += 1;
      curr.totalValue += deal.value;
      map.set(key, curr);
    }
    return Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue).slice(0, 5);
  }, [filteredDeals]);

  const leadsMiniSeries = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - idx));
      d.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setDate(end.getDate() + 1);
      return filteredLeads.filter((x) => {
        const created = new Date(x.createdAt);
        return created >= d && created < end;
      }).length;
    });
    return days;
  }, [filteredLeads]);

  const dealsMiniSeries = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - idx));
      d.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setDate(end.getDate() + 1);
      return filteredDeals.filter((x) => {
        const created = new Date(x.createdAt);
        return created >= d && created < end;
      }).length;
    });
    return days;
  }, [filteredDeals]);

  function handleWidgetDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = selectedWidgets.indexOf(String(active.id));
    const newIndex = selectedWidgets.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    setSelectedWidgets((curr) => arrayMove(curr, oldIndex, newIndex));
  }

  async function saveBuilder() {
    setPending(true);
    const result = await saveDashboardPreference(tenantSlug, {
      roleView,
      widgetIds: enabledWidgets,
    });
    if (!result.ok) {
      showSnackbar(result.error, "error");
      setPending(false);
      return;
    }
    showSnackbar("Dashboard preferences saved.", "success");
    setOpenBuilder(false);
    setPending(false);
    router.refresh();
  }

  async function switchRoleView(next: RoleView) {
    const prevRole = roleView;
    const prevWidgets = selectedWidgets;
    const nextWidgets = ROLE_WIDGETS[next];
    setRoleView(next);
    setSelectedWidgets(nextWidgets);
    setPending(true);
    const result = await saveDashboardPreference(tenantSlug, {
      roleView: next,
      widgetIds: nextWidgets,
    });
    if (!result.ok) {
      setRoleView(prevRole);
      setSelectedWidgets(prevWidgets);
      showSnackbar(result.error, "error");
      setPending(false);
      return;
    }
    showSnackbar("Dashboard view updated.", "success");
    setPending(false);
    router.refresh();
  }

  function saveFilterPreset() {
    const label = presetDraftName.trim() || `Preset ${filterPresets.length + 1}`;
    const nextPreset: FilterPreset = {
      id: String(Date.now()),
      label,
      range: globalRange,
      module: moduleFilter,
      owner: ownerFilter,
      project: projectFilter,
      source: sourceFilter,
    };
    const next = [nextPreset, ...filterPresets].slice(0, 12);
    setFilterPresets(next);
    setPresetDraftName("");
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`dashboard-filter-presets:${tenantSlug}`, JSON.stringify(next));
    }
    showSnackbar("Filter preset saved.", "success");
  }

  function applyFilterPreset(id: string) {
    const preset = filterPresets.find((x) => x.id === id);
    if (!preset) return;
    setGlobalRange(preset.range);
    setModuleFilter(preset.module);
    setOwnerFilter(preset.owner);
    setProjectFilter(preset.project);
    setSourceFilter(preset.source);
    showSnackbar(`Applied preset: ${preset.label}`, "success");
  }

  function removeFilterPreset(id: string) {
    const next = filterPresets.filter((x) => x.id !== id);
    setFilterPresets(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`dashboard-filter-presets:${tenantSlug}`, JSON.stringify(next));
    }
  }

  function clearGlobalFilters() {
    setGlobalRange("1M");
    setModuleFilter("ALL");
    setOwnerFilter("");
    setProjectFilter("");
    setSourceFilter("");
  }

  const ownerLabel = ownerFilter ? values.filterOptions.owners.find((x) => x.id === ownerFilter)?.label || ownerFilter : "";
  const projectLabel = projectFilter ? values.filterOptions.projects.find((x) => x.id === projectFilter)?.label || projectFilter : "";

  async function submitGoal(formData: FormData) {
    setPending(true);
    const result = await upsertTenantGoal(tenantSlug, {
      label: String(formData.get("label") || ""),
      fiscalYearStart: String(formData.get("fiscalYearStart") || ""),
      fiscalYearEnd: String(formData.get("fiscalYearEnd") || ""),
      revenueTarget: String(formData.get("revenueTarget") || ""),
      pipelineTarget: String(formData.get("pipelineTarget") || ""),
    });
    if (!result.ok) {
      showSnackbar(result.error, "error");
      setPending(false);
      return;
    }
    showSnackbar("Fiscal goals updated.", "success");
    setOpenGoal(false);
    setPending(false);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tenantName} Dashboard</h1>
          <div className="mt-1 text-xs text-muted">
            <button
              type="button"
              onClick={() => setOpenScopeFilters(true)}
              className="font-medium text-foreground underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground/60"
            >
              Open dashboard & filters
            </button>
            <span className="text-muted"> · or Quick actions (bottom-right)</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpenBuilder(true)}
            className="rounded-md border border-foreground/20 px-3 py-2 text-sm font-semibold text-foreground hover:bg-foreground/[0.06]"
          >
            Customize dashboard
          </button>
          {canManageGoals ? (
            <button
              type="button"
              onClick={() => setOpenGoal(true)}
              className="rounded-md border border-foreground bg-foreground px-3 py-2 text-sm font-semibold text-background hover:opacity-90"
            >
              Set fiscal goals
            </button>
          ) : null}
        </div>
      </div>

      {values.hrOnboarding.state !== "none" ? (
        <section
          className={[
            "mt-4 rounded-lg border p-4",
            values.hrOnboarding.state === "complete"
              ? "border-emerald-500/30 bg-emerald-500/5"
              : "border-violet-500/30 bg-violet-500/5",
          ].join(" ")}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">HR onboarding</p>
              {values.hrOnboarding.state === "complete" ? (
                <>
                  <p className="mt-1 text-sm font-semibold text-foreground">All forms submitted</p>
                  <p className="mt-1 text-xs text-muted">
                    {values.hrOnboarding.submittedCount} section{values.hrOnboarding.submittedCount === 1 ? "" : "s"}{" "}
                    sent to HR
                    {values.hrOnboarding.submittedAtLabel !== "—"
                      ? ` · ${values.hrOnboarding.submittedAtLabel}`
                      : ""}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {values.hrOnboarding.pendingCount} section{values.hrOnboarding.pendingCount === 1 ? "" : "s"} still
                    to complete
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {values.hrOnboarding.sectionLabels.join(" · ")}
                    {values.hrOnboarding.dueLabel ? ` · due ${values.hrOnboarding.dueLabel}` : ""}
                  </p>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {values.hrOnboarding.state === "pending" && values.hrOnboarding.masterUrl ? (
                <a
                  href={values.hrOnboarding.masterUrl}
                  className="rounded-md border border-foreground bg-foreground px-3 py-2 text-xs font-semibold text-background"
                >
                  Continue forms
                </a>
              ) : null}
              {values.hrOnboarding.state === "complete" && values.hrOnboarding.viewUrl ? (
                <a
                  href={values.hrOnboarding.viewUrl}
                  className="rounded-md border border-foreground/20 px-3 py-2 text-xs font-semibold hover:bg-foreground/[0.06]"
                >
                  View forms
                </a>
              ) : null}
              <a
                href={values.hrOnboarding.hrDashboardUrl}
                className="rounded-md border border-foreground/20 px-3 py-2 text-xs font-semibold hover:bg-foreground/[0.06]"
              >
                My HR dashboard
              </a>
            </div>
          </div>
        </section>
      ) : null}

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowSetupPanel((open) => !open)}
          className="inline-flex items-center gap-2 rounded-md border border-foreground/15 px-3 py-2 text-xs font-semibold text-foreground hover:bg-foreground/[0.04]"
          aria-expanded={showSetupPanel}
        >
          <span>{showSetupPanel ? "Hide" : "Show"} setup &amp; integrations</span>
          <svg
            viewBox="0 0 24 24"
            className={["h-3.5 w-3.5 transition-transform", showSetupPanel ? "rotate-180" : ""].join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {showSetupPanel ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <section className="rounded-lg border border-foreground/10 bg-background p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Getting started</p>
            <button
              type="button"
              onClick={() => setOpenOnboardingGuide(true)}
              className="text-xs font-semibold text-indigo-600 underline decoration-indigo-300 underline-offset-2"
            >
              Launch setup guide
            </button>
          </div>
          <ul className="mt-2 space-y-1.5 text-sm">
            <ChecklistRow label="Connect at least one integration" done={values.onboarding.connectIntegrationDone} />
            <ChecklistRow label="Import your first leads" done={values.onboarding.importedLeadsDone} />
            <ChecklistRow label="Create your first deal" done={values.onboarding.createdDealDone} />
            <ChecklistRow label="Send first follow-up" done={values.onboarding.followUpSentDone} />
            <ChecklistRow label="Complete first task/activity" done={values.onboarding.firstTaskDone} />
          </ul>
        </section>
        <section className="rounded-lg border border-foreground/10 bg-background p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Integration health</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <HealthPill label="Meta Leads" ok={values.integrationHealth.metaLeads} />
            <HealthPill label="WhatsApp" ok={values.integrationHealth.whatsapp} />
            <HealthPill label="SMS (Termii)" ok={values.integrationHealth.sms} />
            <div className="rounded-md border border-foreground/10 px-2 py-1.5">
              <p className="text-[11px] text-muted">Webhook</p>
              <p className="text-xs font-medium text-foreground">
                {values.integrationHealth.inboundWebhookLastAt
                  ? `Last event ${new Date(values.integrationHealth.inboundWebhookLastAt).toLocaleString()}`
                  : "No events yet"}
              </p>
            </div>
          </div>
        </section>
          </div>
        ) : null}
      </div>

      {globalRange !== "1M" || moduleFilter !== "ALL" || ownerFilter || projectFilter || sourceFilter ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-foreground/10 bg-background px-3 py-2.5">
          {globalRange !== "1M" ? (
            <button
              type="button"
              onClick={() => setGlobalRange("1M")}
              className="inline-flex items-center gap-1 rounded-full border border-foreground/15 bg-foreground/[0.04] px-2.5 py-1 text-xs text-foreground hover:bg-foreground/[0.08]"
            >
              <span>Range: {globalRange === "WEEK" ? "This Week" : globalRange}</span>
              <span aria-hidden>×</span>
            </button>
          ) : null}
          {moduleFilter !== "ALL" ? (
            <button
              type="button"
              onClick={() => setModuleFilter("ALL")}
              className="inline-flex items-center gap-1 rounded-full border border-foreground/15 bg-foreground/[0.04] px-2.5 py-1 text-xs text-foreground hover:bg-foreground/[0.08]"
            >
              <span>Module: {moduleFilter}</span>
              <span aria-hidden>×</span>
            </button>
          ) : null}
          {ownerFilter ? (
            <button
              type="button"
              onClick={() => setOwnerFilter("")}
              className="inline-flex items-center gap-1 rounded-full border border-foreground/15 bg-foreground/[0.04] px-2.5 py-1 text-xs text-foreground hover:bg-foreground/[0.08]"
            >
              <span>Owner: {ownerLabel}</span>
              <span aria-hidden>×</span>
            </button>
          ) : null}
          {projectFilter ? (
            <button
              type="button"
              onClick={() => setProjectFilter("")}
              className="inline-flex items-center gap-1 rounded-full border border-foreground/15 bg-foreground/[0.04] px-2.5 py-1 text-xs text-foreground hover:bg-foreground/[0.08]"
            >
              <span>Project: {projectLabel}</span>
              <span aria-hidden>×</span>
            </button>
          ) : null}
          {sourceFilter ? (
            <button
              type="button"
              onClick={() => setSourceFilter("")}
              className="inline-flex items-center gap-1 rounded-full border border-foreground/15 bg-foreground/[0.04] px-2.5 py-1 text-xs text-foreground hover:bg-foreground/[0.08]"
            >
              <span>Source: {sourceFilter}</span>
              <span aria-hidden>×</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setOpenScopeFilters(true)}
            className="rounded-md border border-foreground/20 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-foreground/[0.06]"
          >
            Dashboard & filters
          </button>
          <button
            type="button"
            onClick={clearGlobalFilters}
            className="text-xs font-semibold text-indigo-600 underline decoration-indigo-300 underline-offset-2 dark:text-indigo-400"
          >
            Clear all
          </button>
        </div>
      ) : null}

      {openScopeFilters ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dashboard-scope-filters-title"
        >
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default"
            aria-label="Close dashboard panel"
            onClick={() => setOpenScopeFilters(false)}
          />
          <div
            className="relative flex h-full w-full max-w-lg flex-col border-l border-foreground/10 bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-foreground/10 p-4">
              <div>
                <h2 id="dashboard-scope-filters-title" className="text-sm font-semibold text-foreground">
                  Dashboard & filters
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Role and chart period affect trend widgets; the fields below scope KPI cards, drill-downs, and finance lists.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenScopeFilters(false)}
                className="rounded-md border border-foreground/15 px-2 py-1 text-xs text-muted hover:text-foreground"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Chart widgets</p>
                <p className="mt-1 text-xs text-muted">
                  Collections and pipeline trend charts only—not KPI totals or tables.
                </p>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Dashboard view</label>
                  <UiSelect
                    value={roleView}
                    disabled={roleViewOptions.length <= 1 || pending}
                    onChange={(e) => {
                      const next = e.target.value as RoleView;
                      if (next !== roleView) {
                        void switchRoleView(next);
                      }
                    }}
                  >
                    {roleViewOptions.map((view) => (
                      <option key={view} value={view}>
                        {view.replaceAll("_", " ")}
                      </option>
                    ))}
                  </UiSelect>
                </div>
                <p className="mt-3 text-xs text-muted">
                  {goal
                    ? `${goal.label}: ${goal.fiscalYearStart} to ${goal.fiscalYearEnd}`
                    : "No fiscal goal set yet."}
                </p>
                <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Chart period</p>
                <div className="inline-flex flex-wrap gap-1 rounded-md border border-foreground/10 bg-background p-1">
                  {(["WEEK", "1M", "6M", "12M", "YTD"] as const).map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setChartRange(range)}
                      className={[
                        "rounded px-2.5 py-1 text-xs font-semibold",
                        chartRange === range ? "bg-foreground text-background" : "text-muted hover:text-foreground",
                      ].join(" ")}
                    >
                      {range === "WEEK" ? "This Week" : range === "1M" ? "1 Month" : range}
                    </button>
                  ))}
                </div>
              </div>

              <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-muted">KPI scope</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Date range</label>
                  <UiSelect value={globalRange} onChange={(e) => setGlobalRange(e.target.value as typeof globalRange)}>
                    <option value="TODAY">Today</option>
                    <option value="WEEK">This Week</option>
                    <option value="1M">1 Month</option>
                    <option value="6M">6M</option>
                    <option value="12M">12M</option>
                    <option value="YTD">YTD</option>
                  </UiSelect>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Module</label>
                  <UiSelect value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value as typeof moduleFilter)}>
                    <option value="ALL">All modules</option>
                    <option value="SALES">Sales</option>
                    <option value="FINANCE">Finance</option>
                    <option value="PROJECTS">Projects</option>
                  </UiSelect>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Owner</label>
                  <UiSelect value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
                    <option value="">All owners</option>
                    {values.filterOptions.owners.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </UiSelect>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Project</label>
                  <UiSelect value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
                    <option value="">All projects</option>
                    {values.filterOptions.projects.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </UiSelect>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Lead source</label>
                  <UiSelect value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                    <option value="">All sources</option>
                    {values.filterOptions.leadSources.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </UiSelect>
                </div>
              </div>
              {globalRange !== "1M" || moduleFilter !== "ALL" || ownerFilter || projectFilter || sourceFilter ? (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-foreground/10 pt-4">
                  {globalRange !== "1M" ? (
                    <button
                      type="button"
                      onClick={() => setGlobalRange("1M")}
                      className="inline-flex items-center gap-1 rounded-full border border-foreground/15 bg-foreground/[0.04] px-2.5 py-1 text-xs text-foreground hover:bg-foreground/[0.08]"
                    >
                      <span>Range: {globalRange === "WEEK" ? "This Week" : globalRange}</span>
                      <span aria-hidden>×</span>
                    </button>
                  ) : null}
                  {moduleFilter !== "ALL" ? (
                    <button
                      type="button"
                      onClick={() => setModuleFilter("ALL")}
                      className="inline-flex items-center gap-1 rounded-full border border-foreground/15 bg-foreground/[0.04] px-2.5 py-1 text-xs text-foreground hover:bg-foreground/[0.08]"
                    >
                      <span>Module: {moduleFilter}</span>
                      <span aria-hidden>×</span>
                    </button>
                  ) : null}
                  {ownerFilter ? (
                    <button
                      type="button"
                      onClick={() => setOwnerFilter("")}
                      className="inline-flex items-center gap-1 rounded-full border border-foreground/15 bg-foreground/[0.04] px-2.5 py-1 text-xs text-foreground hover:bg-foreground/[0.08]"
                    >
                      <span>Owner: {ownerLabel}</span>
                      <span aria-hidden>×</span>
                    </button>
                  ) : null}
                  {projectFilter ? (
                    <button
                      type="button"
                      onClick={() => setProjectFilter("")}
                      className="inline-flex items-center gap-1 rounded-full border border-foreground/15 bg-foreground/[0.04] px-2.5 py-1 text-xs text-foreground hover:bg-foreground/[0.08]"
                    >
                      <span>Project: {projectLabel}</span>
                      <span aria-hidden>×</span>
                    </button>
                  ) : null}
                  {sourceFilter ? (
                    <button
                      type="button"
                      onClick={() => setSourceFilter("")}
                      className="inline-flex items-center gap-1 rounded-full border border-foreground/15 bg-foreground/[0.04] px-2.5 py-1 text-xs text-foreground hover:bg-foreground/[0.08]"
                    >
                      <span>Source: {sourceFilter}</span>
                      <span aria-hidden>×</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={clearGlobalFilters}
                    className="text-xs font-semibold text-indigo-600 underline decoration-indigo-300 underline-offset-2 dark:text-indigo-400"
                  >
                    Clear all
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-2">
        {openFabMenu ? (
          <div className="w-52 rounded-lg border border-foreground/10 bg-background p-2 shadow-2xl">
            <button
              type="button"
              onClick={() => {
                setOpenScopeFilters(true);
                setOpenFabMenu(false);
              }}
              className="flex w-full items-center rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-foreground/[0.06]"
            >
              Dashboard & filters
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenSavedViews((v) => !v);
                setOpenFabMenu(false);
              }}
              className="mt-0.5 flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-foreground/[0.06]"
            >
              <span>Saved views</span>
              <span className="text-xs text-muted">{openSavedViews ? "On" : "Off"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpenOnboardingGuide(true);
                setOpenFabMenu(false);
              }}
              className="mt-0.5 flex w-full items-center rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-foreground/[0.06]"
            >
              Launch setup guide
            </button>
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => setOpenFabMenu((v) => !v)}
          className="rounded-full border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-lg hover:opacity-90"
        >
          Quick actions
        </button>
      </div>

      {openSavedViews ? (
        <div className="fixed bottom-20 right-6 z-40 flex max-h-[min(70vh,520px)] w-[min(92vw,560px)] flex-col overflow-hidden rounded-xl border border-foreground/10 bg-background shadow-2xl">
          <div className="shrink-0 border-b border-foreground/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Saved views</h3>
              <p className="text-xs text-muted">Save current filters and re-apply them in one click.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpenSavedViews(false)}
              className="rounded-md border border-foreground/15 px-2 py-1 text-xs text-muted hover:text-foreground"
            >
              Close
            </button>
          </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-3">
          <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_auto]">
            <UiSelect defaultValue="" onChange={(e) => e.target.value && applyFilterPreset(e.target.value)}>
              <option value="">Select a saved view</option>
              {filterPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </UiSelect>
            <input
              value={presetDraftName}
              onChange={(e) => setPresetDraftName(e.target.value)}
              placeholder="Name this view"
              className="w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
            <button
              type="button"
              onClick={saveFilterPreset}
              className="rounded-md border border-foreground/20 px-3 py-2 text-sm font-semibold text-foreground hover:bg-foreground/[0.06]"
            >
              Save
            </button>
          </div>

          {filterPresets.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {filterPresets.slice(0, 6).map((preset) => (
                <div key={preset.id} className="inline-flex items-center overflow-hidden rounded-full border border-foreground/15">
                  <button
                    type="button"
                    onClick={() => applyFilterPreset(preset.id)}
                    className="px-2.5 py-1 text-xs text-foreground hover:bg-foreground/[0.06]"
                  >
                    {preset.label}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFilterPreset(preset.id)}
                    className="border-l border-foreground/15 px-2 py-1 text-xs text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                    aria-label={`Delete ${preset.label}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted">No saved views yet.</p>
          )}
          </div>
        </div>
      ) : null}

      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => setOpenKpiDetail("LEADS_TODAY")}
          className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-4 text-left hover:bg-violet-500/15"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">Leads today</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{leadsTodayCount}</p>
          <MiniBars values={leadsMiniSeries} tone="violet" />
          <p className="mt-1 text-xs text-muted">Click for lead-level breakdown</p>
        </button>
        <button
          type="button"
          onClick={() => setOpenKpiDetail("DEALS_TODAY")}
          className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-left hover:bg-indigo-500/15"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">Deals today</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{dealsTodayCount}</p>
          <MiniBars values={dealsMiniSeries} tone="indigo" />
          <p className="mt-1 text-xs text-muted">Click for deal-level breakdown</p>
        </button>
        <button
          type="button"
          onClick={() => setOpenKpiDetail("PROJECTS")}
          className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-left hover:bg-cyan-500/15"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Projects</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{filteredProjects.length}</p>
          <p className="mt-1 text-xs text-muted">Click for project activity</p>
        </button>
        <button
          type="button"
          onClick={() => setOpenKpiDetail("TOP_PROJECTS")}
          className="rounded-xl border border-foreground/20 bg-foreground/[0.04] p-4 text-left hover:bg-foreground/[0.07]"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Top projects</p>
          <p className="mt-2 text-base font-semibold text-foreground">{topProjects[0]?.projectName || "No ranked project yet"}</p>
          <p className="mt-2 text-xs text-muted">
            {topProjects[0] ? `${topProjects[0].dealCount} deals / ${formatMoney(topProjects[0].totalValue)}` : "Click to see rankings"}
          </p>
        </button>
      </section>

      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Phase 3 Finance Analytics</h2>
          <p className="text-xs text-muted">All cards support transaction-level drilldown.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={() => setOpenFinanceDetail("COLLECTIONS_TREND")}
            className="rounded-lg border border-foreground/10 bg-background p-3 text-left hover:bg-foreground/[0.03]"
          >
            <p className="text-xs uppercase tracking-wide text-muted">Collections trend</p>
            <p className="mt-1 text-sm text-foreground">
              {formatMoney(collectionsTrend.reduce((s, x) => s + x.collected, 0))} collected / last 6 months
            </p>
          </button>
          <button
            type="button"
            onClick={() => setOpenFinanceDetail("OVERDUE_AGING")}
            className="rounded-lg border border-foreground/10 bg-background p-3 text-left hover:bg-foreground/[0.03]"
          >
            <p className="text-xs uppercase tracking-wide text-muted">Overdue aging buckets</p>
            <p className="mt-1 text-sm text-foreground">
              {formatMoney(overdueAging.d1_30 + overdueAging.d31_60 + overdueAging.d61_90 + overdueAging.d90p)} overdue
            </p>
          </button>
          <button
            type="button"
            onClick={() => setOpenFinanceDetail("HEALTH_PROJECT_TEAM")}
            className="rounded-lg border border-foreground/10 bg-background p-3 text-left hover:bg-foreground/[0.03]"
          >
            <p className="text-xs uppercase tracking-wide text-muted">Invoice/payment health</p>
            <p className="mt-1 text-sm text-foreground">By project and by owner/team</p>
          </button>
          <button
            type="button"
            onClick={() => setOpenFinanceDetail("TARGET_ATTAINMENT")}
            className="rounded-lg border border-foreground/10 bg-background p-3 text-left hover:bg-foreground/[0.03]"
          >
            <p className="text-xs uppercase tracking-wide text-muted">Target attainment</p>
            <p className="mt-1 text-sm text-foreground">By fiscal periods</p>
          </button>
        </div>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {widgetOrder.map((id) => (
          <WidgetCard
            key={id}
            id={id}
            values={values}
            goal={goal}
            revenueSeries={seriesRevenue}
            pipelineSeries={seriesPipeline}
          />
        ))}
        {widgetOrder.length === 0 ? (
          <div className="rounded-lg border border-dashed border-foreground/15 p-4 text-sm text-muted">
            No widgets selected for this role view.
          </div>
        ) : null}
      </div>

      {openKpiDetail ? (
        <div className="fixed inset-0 z-[70] flex justify-end bg-black/30 backdrop-blur-[1px]">
          <div className="relative flex h-full w-full max-w-5xl flex-col overflow-hidden border-l border-foreground/10 bg-background shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-foreground/10 px-5 py-4 pr-14">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {openKpiDetail === "LEADS_TODAY"
                    ? "Leads Today Breakdown"
                    : openKpiDetail === "DEALS_TODAY"
                      ? "Deals Today Breakdown"
                      : openKpiDetail === "PROJECTS"
                        ? "Project Breakdown"
                        : "Top Projects Breakdown"}
                </h3>
                <p className="text-xs text-muted">Filtered by the current global dashboard controls.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpenKpiDetail(null)}
              className="absolute right-4 top-4 z-[80] rounded-md border border-foreground/15 bg-background px-2 py-1 text-xs text-muted hover:text-foreground"
            >
              Close
            </button>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-2">
            {openKpiDetail === "LEADS_TODAY" ? (
              <div className="overflow-hidden rounded-lg border border-foreground/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-foreground/[0.05] text-xs uppercase text-muted">
                    <tr>
                      <th className="px-3 py-2">Lead</th>
                      <th className="px-3 py-2">Owner</th>
                      <th className="px-3 py-2">Source</th>
                      <th className="px-3 py-2">Project</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.slice(0, 60).map((row) => (
                      <tr key={row.id} className="border-t border-foreground/10">
                        <td className="px-3 py-2">{row.name}</td>
                        <td className="px-3 py-2">{row.ownerLabel}</td>
                        <td className="px-3 py-2">{row.source}</td>
                        <td className="px-3 py-2">{row.projectInterest}</td>
                        <td className="px-3 py-2">
                          <Link
                            className="text-xs font-semibold text-indigo-600 hover:underline"
                            href={`/${tenantSlug}/leads?owner=${encodeURIComponent(row.ownerId || "")}&source=${encodeURIComponent(row.source)}`}
                          >
                            Open Leads
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {filteredLeads.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-muted" colSpan={5}>
                          No leads found for this filter scope.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : null}

            {openKpiDetail === "DEALS_TODAY" ? (
              <div className="overflow-hidden rounded-lg border border-foreground/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-foreground/[0.05] text-xs uppercase text-muted">
                    <tr>
                      <th className="px-3 py-2">Deal ID</th>
                      <th className="px-3 py-2">Owner</th>
                      <th className="px-3 py-2">Stage</th>
                      <th className="px-3 py-2">Value</th>
                      <th className="px-3 py-2">Project</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeals.slice(0, 60).map((row) => (
                      <tr key={row.id} className="border-t border-foreground/10">
                        <td className="px-3 py-2 font-mono text-xs text-muted">{row.id.slice(0, 8)}</td>
                        <td className="px-3 py-2">{row.ownerLabel}</td>
                        <td className="px-3 py-2">{formatEnumLabel(row.stage)}</td>
                        <td className="px-3 py-2">{formatMoney(row.value)}</td>
                        <td className="px-3 py-2">{row.projectName}</td>
                        <td className="px-3 py-2">
                          <Link
                            className="text-xs font-semibold text-indigo-600 hover:underline"
                            href={`/${tenantSlug}/deals?owner=${encodeURIComponent(row.ownerId || "")}&stage=${encodeURIComponent(row.stage)}&projectId=${encodeURIComponent(row.projectId || "")}`}
                          >
                            Open Deals
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {filteredDeals.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-muted" colSpan={6}>
                          No deals found for this filter scope.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : null}

            {openKpiDetail === "PROJECTS" ? (
              <div className="overflow-hidden rounded-lg border border-foreground/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-foreground/[0.05] text-xs uppercase text-muted">
                    <tr>
                      <th className="px-3 py-2">Project</th>
                      <th className="px-3 py-2">Deals</th>
                      <th className="px-3 py-2">Pipeline Value</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map((project) => {
                      const relatedDeals = filteredDeals.filter((d) => d.projectId === project.id);
                      const total = relatedDeals.reduce((sum, d) => sum + d.value, 0);
                      return (
                        <tr key={project.id} className="border-t border-foreground/10">
                          <td className="px-3 py-2">{project.name}</td>
                          <td className="px-3 py-2">{relatedDeals.length}</td>
                          <td className="px-3 py-2">{formatMoney(total)}</td>
                          <td className="px-3 py-2">
                            <Link
                              className="text-xs font-semibold text-indigo-600 hover:underline"
                              href={`/${tenantSlug}/projects?projectId=${encodeURIComponent(project.id)}`}
                            >
                              Open Projects
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredProjects.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-muted" colSpan={4}>
                          No projects found for this filter scope.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : null}

            {openKpiDetail === "TOP_PROJECTS" ? (
              <div className="overflow-hidden rounded-lg border border-foreground/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-foreground/[0.05] text-xs uppercase text-muted">
                    <tr>
                      <th className="px-3 py-2">Rank</th>
                      <th className="px-3 py-2">Project</th>
                      <th className="px-3 py-2">Deals</th>
                      <th className="px-3 py-2">Pipeline Value</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProjects.map((row, idx) => (
                      <tr key={`${row.projectName}-${idx}`} className="border-t border-foreground/10">
                        <td className="px-3 py-2">#{idx + 1}</td>
                        <td className="px-3 py-2">{row.projectName}</td>
                        <td className="px-3 py-2">{row.dealCount}</td>
                        <td className="px-3 py-2">{formatMoney(row.totalValue)}</td>
                        <td className="px-3 py-2">
                          <Link
                            className="text-xs font-semibold text-indigo-600 hover:underline"
                            href={`/${tenantSlug}/deals?projectId=${encodeURIComponent(row.projectId || "")}`}
                          >
                            Open Deals
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {topProjects.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-muted" colSpan={5}>
                          No ranked projects found for this filter scope.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {openFinanceDetail ? (
        <div className="fixed inset-0 z-[70] flex justify-end bg-black/30 backdrop-blur-[1px]">
          <div className="relative flex h-full w-full max-w-5xl flex-col overflow-hidden border-l border-foreground/10 bg-background shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-foreground/10 px-5 py-4 pr-14">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  {openFinanceDetail === "COLLECTIONS_TREND"
                    ? "Collections Trend"
                    : openFinanceDetail === "OVERDUE_AGING"
                      ? "Overdue Aging Buckets"
                      : openFinanceDetail === "HEALTH_PROJECT_TEAM"
                        ? "Invoice/Payment Health by Project & Team"
                        : "Target Attainment by Fiscal Period"}
                </h3>
                <p className="text-xs text-muted">Drilldown to transaction-level details for the active dashboard filters.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpenFinanceDetail(null)}
              className="absolute right-4 top-4 z-[80] rounded-md border border-foreground/15 bg-background px-2 py-1 text-xs text-muted hover:text-foreground"
            >
              Close
            </button>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-2">
              {openFinanceDetail === "COLLECTIONS_TREND" ? (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-lg border border-foreground/10">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-foreground/[0.05] text-xs uppercase text-muted">
                        <tr>
                          <th className="px-3 py-2">Period</th>
                          <th className="px-3 py-2">Invoiced</th>
                          <th className="px-3 py-2">Collected</th>
                          <th className="px-3 py-2">Outstanding</th>
                        </tr>
                      </thead>
                      <tbody>
                        {collectionsTrend.map((row) => (
                          <tr key={row.label} className="border-t border-foreground/10">
                            <td className="px-3 py-2">{row.label}</td>
                            <td className="px-3 py-2">{formatMoney(row.invoiced)}</td>
                            <td className="px-3 py-2">{formatMoney(row.collected)}</td>
                            <td className="px-3 py-2">{formatMoney(row.outstanding)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-foreground/10">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-foreground/[0.05] text-xs uppercase text-muted">
                        <tr>
                          <th className="px-3 py-2">Payment ID</th>
                          <th className="px-3 py-2">Invoice</th>
                          <th className="px-3 py-2">Project</th>
                          <th className="px-3 py-2">Owner</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Paid at</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFinancePayments.slice(0, 120).map((row) => (
                          <tr key={row.id} className="border-t border-foreground/10">
                            <td className="px-3 py-2 font-mono text-xs text-muted">{row.id.slice(0, 8)}</td>
                            <td className="px-3 py-2">{row.invoiceNumber}</td>
                            <td className="px-3 py-2">{row.projectName}</td>
                            <td className="px-3 py-2">{row.ownerLabel}</td>
                            <td className="px-3 py-2">{formatMoney(row.amount)}</td>
                            <td className="px-3 py-2">{new Date(row.paidAt).toLocaleDateString("en-NG")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {openFinanceDetail === "OVERDUE_AGING" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-md border border-foreground/10 p-3 text-sm">Current: {formatMoney(overdueAging.current)}</div>
                    <div className="rounded-md border border-foreground/10 p-3 text-sm">1-30: {formatMoney(overdueAging.d1_30)}</div>
                    <div className="rounded-md border border-foreground/10 p-3 text-sm">31-60: {formatMoney(overdueAging.d31_60)}</div>
                    <div className="rounded-md border border-foreground/10 p-3 text-sm">61-90: {formatMoney(overdueAging.d61_90)}</div>
                    <div className="rounded-md border border-foreground/10 p-3 text-sm">90+: {formatMoney(overdueAging.d90p)}</div>
                    <div className="rounded-md border border-foreground/10 p-3 text-sm">No due date: {formatMoney(overdueAging.noDueDate)}</div>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-foreground/10">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-foreground/[0.05] text-xs uppercase text-muted">
                        <tr>
                          <th className="px-3 py-2">Invoice</th>
                          <th className="px-3 py-2">Project</th>
                          <th className="px-3 py-2">Owner</th>
                          <th className="px-3 py-2">Due date</th>
                          <th className="px-3 py-2">Balance</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFinanceInvoices
                          .filter((x) => x.balanceDue > 0 && x.status !== "VOID")
                          .slice(0, 120)
                          .map((row) => (
                            <tr key={row.id} className="border-t border-foreground/10">
                              <td className="px-3 py-2">{row.invoiceNumber}</td>
                              <td className="px-3 py-2">{row.projectName}</td>
                              <td className="px-3 py-2">{row.ownerLabel}</td>
                              <td className="px-3 py-2">{row.dueDate ? new Date(row.dueDate).toLocaleDateString("en-NG") : "—"}</td>
                              <td className="px-3 py-2">{formatMoney(row.balanceDue)}</td>
                              <td className="px-3 py-2">{formatEnumLabel(row.status)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {openFinanceDetail === "HEALTH_PROJECT_TEAM" ? (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-lg border border-foreground/10">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-foreground/[0.05] text-xs uppercase text-muted">
                        <tr>
                          <th className="px-3 py-2">Project</th>
                          <th className="px-3 py-2">Invoiced</th>
                          <th className="px-3 py-2">Collected</th>
                          <th className="px-3 py-2">Outstanding</th>
                        </tr>
                      </thead>
                      <tbody>
                        {financeHealthRows.projects.map((row) => (
                          <tr key={row.label} className="border-t border-foreground/10">
                            <td className="px-3 py-2">{row.label}</td>
                            <td className="px-3 py-2">{formatMoney(row.invoiced)}</td>
                            <td className="px-3 py-2">{formatMoney(row.collected)}</td>
                            <td className="px-3 py-2">{formatMoney(row.outstanding)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-foreground/10">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-foreground/[0.05] text-xs uppercase text-muted">
                        <tr>
                          <th className="px-3 py-2">Owner / Team</th>
                          <th className="px-3 py-2">Invoiced</th>
                          <th className="px-3 py-2">Collected</th>
                          <th className="px-3 py-2">Outstanding</th>
                        </tr>
                      </thead>
                      <tbody>
                        {financeHealthRows.owners.map((row) => (
                          <tr key={row.label} className="border-t border-foreground/10">
                            <td className="px-3 py-2">{row.label}</td>
                            <td className="px-3 py-2">{formatMoney(row.invoiced)}</td>
                            <td className="px-3 py-2">{formatMoney(row.collected)}</td>
                            <td className="px-3 py-2">{formatMoney(row.outstanding)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {openFinanceDetail === "TARGET_ATTAINMENT" ? (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-lg border border-foreground/10">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-foreground/[0.05] text-xs uppercase text-muted">
                        <tr>
                          <th className="px-3 py-2">Fiscal period</th>
                          <th className="px-3 py-2">Actual</th>
                          <th className="px-3 py-2">Target</th>
                          <th className="px-3 py-2">Attainment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fiscalAttainment.periods.map((row) => (
                          <tr key={row.period} className="border-t border-foreground/10">
                            <td className="px-3 py-2">{row.period}</td>
                            <td className="px-3 py-2">{formatMoney(row.actual)}</td>
                            <td className="px-3 py-2">{formatMoney(row.target)}</td>
                            <td className="px-3 py-2">{row.attainmentPct}%</td>
                          </tr>
                        ))}
                        {fiscalAttainment.periods.length === 0 ? (
                          <tr>
                            <td className="px-3 py-3 text-muted" colSpan={4}>
                              Set fiscal goals to enable target attainment analytics.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-foreground/10">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-foreground/[0.05] text-xs uppercase text-muted">
                        <tr>
                          <th className="px-3 py-2">Payment</th>
                          <th className="px-3 py-2">Invoice</th>
                          <th className="px-3 py-2">Project</th>
                          <th className="px-3 py-2">Owner</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFinancePayments.slice(0, 120).map((row) => (
                          <tr key={row.id} className="border-t border-foreground/10">
                            <td className="px-3 py-2 font-mono text-xs text-muted">{row.id.slice(0, 8)}</td>
                            <td className="px-3 py-2">{row.invoiceNumber}</td>
                            <td className="px-3 py-2">{row.projectName}</td>
                            <td className="px-3 py-2">{row.ownerLabel}</td>
                            <td className="px-3 py-2">{formatMoney(row.amount)}</td>
                            <td className="px-3 py-2">{new Date(row.paidAt).toLocaleDateString("en-NG")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {openOnboardingGuide ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-foreground/10 bg-background p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Setup guide</h2>
                <p className="mt-1 text-sm text-muted">Complete these steps to get your team live quickly.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenOnboardingGuide(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="mt-4 space-y-2">
              <GuideItem done={values.onboarding.connectIntegrationDone} title="Connect integrations" href={`/${tenantSlug}/settings`} />
              <GuideItem done={values.onboarding.importedLeadsDone} title="Import your first leads" href={`/${tenantSlug}/leads/import`} />
              <GuideItem done={values.onboarding.createdDealDone} title="Create first deal" href={`/${tenantSlug}/deals`} />
              <GuideItem done={values.onboarding.followUpSentDone} title="Send first follow-up" href={`/${tenantSlug}/activities?channel=WHATSAPP`} />
              <GuideItem done={values.onboarding.firstTaskDone} title="Complete first task" href={`/${tenantSlug}/activities?status=PENDING`} />
            </div>
          </div>
        </div>
      ) : null}

      {openBuilder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-foreground/10 bg-background shadow-2xl">
            <div className="flex shrink-0 items-start justify-between border-b border-foreground/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-foreground">Dashboard Builder</h2>
              <button
                type="button"
                onClick={() => setOpenBuilder(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div>
                <label className="mb-1 block text-sm text-muted">Role view</label>
                <UiSelect
                  value={roleView}
                  onChange={(e) => {
                    const next = e.target.value as RoleView;
                    setRoleView(next);
                    setSelectedWidgets(ROLE_WIDGETS[next]);
                  }}
                >
                  {roleViewOptions.map((role) => (
                    <option key={role} value={role}>
                      {role.replaceAll("_", " ")}
                    </option>
                  ))}
                </UiSelect>
              </div>

              <div className="mt-4 grid gap-2">
                {widgetPool.map((id) => {
                  const checked = selectedWidgets.includes(id);
                  return (
                    <label key={id} className="flex items-center gap-2 rounded-md border border-foreground/10 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedWidgets((curr) =>
                            checked ? curr.filter((x) => x !== id) : [...curr, id],
                          )
                        }
                      />
                      <span>{WIDGET_LABELS[id] || id}</span>
                    </label>
                  );
                })}
              </div>

              {enabledWidgets.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-semibold text-foreground">Widget order (drag to arrange)</p>
                  <DndContext
                    id="tenant-dashboard-widget-order"
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleWidgetDragEnd}
                  >
                    <SortableContext items={enabledWidgets} strategy={rectSortingStrategy}>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {enabledWidgets.map((id) => (
                          <SortableWidgetItem key={id} id={id} label={WIDGET_LABELS[id] || id} />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-foreground/10 px-5 py-4">
              <button
                type="button"
                onClick={() => setOpenBuilder(false)}
                className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={saveBuilder}
                className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Saving..." : "Save dashboard"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {openGoal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-foreground/10 bg-background shadow-2xl">
            <div className="flex shrink-0 items-start justify-between border-b border-foreground/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-foreground">Fiscal / Business Year Goals</h2>
              <button
                type="button"
                onClick={() => setOpenGoal(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <form action={submitGoal} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm text-muted">Goal label</label>
                    <input
                      name="label"
                      defaultValue={goal?.label || "FY 2026"}
                      className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-muted">Fiscal year start</label>
                    <input
                      name="fiscalYearStart"
                      type="date"
                      defaultValue={goal?.fiscalYearStart || ""}
                      className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-muted">Fiscal year end</label>
                    <input
                      name="fiscalYearEnd"
                      type="date"
                      defaultValue={goal?.fiscalYearEnd || ""}
                      className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-muted">Revenue target</label>
                    <input
                      name="revenueTarget"
                      inputMode="decimal"
                      defaultValue={goal?.revenueTarget != null ? String(goal.revenueTarget) : ""}
                      className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-muted">Pipeline target</label>
                    <input
                      name="pipelineTarget"
                      inputMode="decimal"
                      defaultValue={goal?.pipelineTarget != null ? String(goal.pipelineTarget) : ""}
                      className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                    />
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 justify-end gap-2 border-t border-foreground/10 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setOpenGoal(false)}
                  className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? "Saving..." : "Save goals"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WidgetCard({
  id,
  values,
  goal,
  revenueSeries,
  pipelineSeries,
}: {
  id: string;
  values: WidgetValue;
  goal: Goal;
  revenueSeries: Array<{ label: string; value: number }>;
  pipelineSeries: Array<{ label: string; pipeline: number; target: number }>;
}) {
  const chartPalette = {
    revenue: "#7c3aed", // violet
    pipeline: "#2563eb", // blue
    target: "#22c7d6", // cyan
    funnel: "#8b5cf6", // purple
    leaderboard: "#4f46e5", // indigo
  };
  const money = (n: number) => `NGN ${Math.round(n).toLocaleString()}`;
  const maxFunnel = Math.max(1, ...values.leadFunnel.map((x) => x.count));
  const maxLeaderboard = Math.max(1, ...values.leaderboard.map((x) => x.value));
  const maxSourceLeads = Math.max(1, ...values.leadSourceQuality.map((x) => x.leads));
  const maxProjectValue = Math.max(1, ...values.topProjectsIntelligence.map((x) => x.dealValue));
  const maxRepCurrent = Math.max(1, ...values.repLeaderboardTrend.map((x) => x.current));
  const inventoryTotal = Math.max(1, values.availableUnits + values.reservedUnits + values.soldUnits);
  const revenuePct =
    goal?.revenueTarget && goal.revenueTarget > 0 ? Math.min(100, (values.revenueMtd / goal.revenueTarget) * 100) : null;
  const pipelinePct =
    goal?.pipelineTarget && goal.pipelineTarget > 0 ? Math.min(100, (values.pipelineOpen / goal.pipelineTarget) * 100) : null;

  const maxRevenueMonth = Math.max(1, ...revenueSeries.map((x) => x.value));
  const maxPipelineTrend = Math.max(
    1,
    ...pipelineSeries.map((x) => Math.max(x.pipeline, x.target)),
  );

  let title = id;
  let body: React.ReactNode = <p className="mt-2 text-sm text-muted">No data.</p>;

  if (id === "revenue_target_progress") {
    title = "Collections vs target (MTD)";
    body = (
      <>
        <p className="mt-2 text-2xl font-bold text-foreground">{money(values.revenueMtd)}</p>
        <p className="text-xs text-muted">
          Cash collected this month vs fiscal revenue target:{" "}
          {goal?.revenueTarget != null ? money(goal.revenueTarget) : "No target set"}
        </p>
        <div className="mt-3 h-2.5 rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${revenuePct ?? 0}%`, backgroundColor: chartPalette.revenue }}
          />
        </div>
        <p className="mt-1 text-xs text-muted">{revenuePct != null ? `${revenuePct.toFixed(1)}% of target` : "Set goal to track progress"}</p>
      </>
    );
  } else if (id === "pipeline_target_progress") {
    title = "Pipeline vs Target";
    body = (
      <>
        <p className="mt-2 text-2xl font-bold text-foreground">{money(values.pipelineOpen)}</p>
        <p className="text-xs text-muted">
          Target: {goal?.pipelineTarget != null ? money(goal.pipelineTarget) : "No target set"}
        </p>
        <div className="mt-3 h-2.5 rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pipelinePct ?? 0}%`, backgroundColor: chartPalette.pipeline }}
          />
        </div>
        <p className="mt-1 text-xs text-muted">{pipelinePct != null ? `${pipelinePct.toFixed(1)}% of target` : "Set goal to track progress"}</p>
      </>
    );
  } else if (id === "lead_funnel") {
    title = "Lead Funnel";
    body = (
      <div className="mt-3 space-y-2">
        {values.leadFunnel.map((item) => (
          <div key={item.stage}>
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{item.stage}</span>
              <span>{item.count}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(6, (item.count / maxFunnel) * 100)}%`, backgroundColor: chartPalette.funnel }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  } else if (id === "sales_leaderboard") {
    title = "Sales Leaderboard";
    body = values.leaderboard.length ? (
      <div className="mt-3 space-y-2">
        {values.leaderboard.slice(0, 5).map((x) => (
          <div key={x.label}>
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="truncate">{x.label}</span>
              <span>{money(x.value)}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(8, (x.value / maxLeaderboard) * 100)}%`, backgroundColor: chartPalette.leaderboard }}
              />
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p className="mt-2 text-sm text-muted">No leaderboard data yet.</p>
    );
  } else if (id === "stage_velocity_dropoff") {
    title = "Stage velocity + drop-off";
    body = values.stageVelocity.length ? (
      <div className="mt-2 space-y-2">
        {values.stageVelocity.map((row) => (
          <div key={row.stage} className="rounded-md border border-foreground/10 p-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{row.stage}</span>
              <span className="text-muted">{row.avgDays}d avg | {row.dropOffPct}% drop-off</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(100, Math.max(6, row.dropOffPct))}%`, backgroundColor: "#ef4444" }}
              />
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p className="mt-2 text-sm text-muted">Not enough stage data yet.</p>
    );
  } else if (id === "lead_source_quality") {
    title = "Lead source quality";
    body = values.leadSourceQuality.length ? (
      <div className="mt-2 space-y-2">
        {values.leadSourceQuality.slice(0, 5).map((row) => (
          <div key={row.source}>
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="truncate">{row.source}</span>
              <span>{row.winRate}% win | {row.wonDeals}/{row.leads}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(8, (row.leads / maxSourceLeads) * 100)}%`, backgroundColor: "#0891b2" }}
              />
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p className="mt-2 text-sm text-muted">No lead source data yet.</p>
    );
  } else if (id === "top_projects_intel") {
    title = "Top projects (leads, value, conversion)";
    body = values.topProjectsIntelligence.length ? (
      <div className="mt-2 space-y-2">
        {values.topProjectsIntelligence.slice(0, 5).map((row) => (
          <div key={row.project}>
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="truncate">{row.project}</span>
              <span>{row.leads} leads | {row.conversionRate}% conv</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(8, (row.dealValue / maxProjectValue) * 100)}%`, backgroundColor: "#7c3aed" }}
              />
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p className="mt-2 text-sm text-muted">No project intelligence data yet.</p>
    );
  } else if (id === "rep_leaderboard_trend") {
    title = "Rep leaderboard with trend";
    body = values.repLeaderboardTrend.length ? (
      <div className="mt-2 space-y-2">
        {values.repLeaderboardTrend.slice(0, 6).map((row) => (
          <div key={row.label}>
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="truncate">{row.label}</span>
              <span className={row.deltaPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                {row.deltaPct >= 0 ? "+" : ""}{row.deltaPct}% | {money(row.current)}
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(8, (row.current / maxRepCurrent) * 100)}%`, backgroundColor: chartPalette.leaderboard }}
              />
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p className="mt-2 text-sm text-muted">No rep trend data yet.</p>
    );
  } else if (id === "revenue_monthly_bar") {
    title = "Collections by period";
    body = (
      <div className="mt-3 overflow-hidden">
        <div className="flex h-28 items-end gap-1.5">
          {revenueSeries.map((item) => (
            <div key={item.label} className="flex flex-1 flex-col items-center">
              <div className="relative flex w-full justify-center">
                <div
                  className="w-full rounded-t-sm"
                  style={{
                    height: `${Math.max(6, (item.value / maxRevenueMonth) * 92)}px`,
                    backgroundColor: chartPalette.revenue,
                  }}
                  title={`${item.label}: ${money(item.value)}`}
                />
              </div>
              <span className="mt-1 text-[9px] text-muted">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  } else if (id === "pipeline_target_trend") {
    title = "Pipeline vs Target per month";
    const w = 320;
    const h = 120;
    const pointsPipeline = pipelineSeries
      .map((item, i) => {
        const x = (i / Math.max(1, pipelineSeries.length - 1)) * (w - 20) + 10;
        const y = h - (item.pipeline / maxPipelineTrend) * (h - 20) - 10;
        return `${x},${y}`;
      })
      .join(" ");
    const pointsTarget = pipelineSeries
      .map((item, i) => {
        const x = (i / Math.max(1, pipelineSeries.length - 1)) * (w - 20) + 10;
        const y = h - (item.target / maxPipelineTrend) * (h - 20) - 10;
        return `${x},${y}`;
      })
      .join(" ");
    body = (
      <div className="mt-3">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
          <line x1="10" y1={h - 10} x2={w - 10} y2={h - 10} stroke="currentColor" className="text-foreground/20" />
          <polyline fill="none" stroke={chartPalette.pipeline} strokeWidth="3" points={pointsPipeline} />
          <polyline fill="none" stroke={chartPalette.target} strokeWidth="3" points={pointsTarget} />
        </svg>
        <div className="mt-2 flex items-center gap-4 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chartPalette.pipeline }} /> Pipeline
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chartPalette.target }} /> Target
          </span>
        </div>
        <div className="mt-2 flex justify-between text-[9px] text-muted">
          {pipelineSeries.map((x, idx) => (
            <span key={`${x.label}-${idx}`} className={idx % 2 === 0 ? "" : "opacity-60"}>
              {x.label}
            </span>
          ))}
        </div>
      </div>
    );
  } else if (id === "inventory_snapshot") {
    title = "Inventory Snapshot";
    body = (
      <>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-foreground/10">
          <div className="flex h-full w-full">
            <div className="bg-emerald-500" style={{ width: `${(values.availableUnits / inventoryTotal) * 100}%` }} />
            <div className="bg-amber-500" style={{ width: `${(values.reservedUnits / inventoryTotal) * 100}%` }} />
            <div className="bg-rose-500" style={{ width: `${(values.soldUnits / inventoryTotal) * 100}%` }} />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <StatPill label="Available" value={values.availableUnits} tone="emerald" />
          <StatPill label="Reserved" value={values.reservedUnits} tone="amber" />
          <StatPill label="Sold" value={values.soldUnits} tone="rose" />
        </div>
      </>
    );
  } else {
    const flat: Record<string, { title: string; value: string; tone: string }> = {
      pending_finance_count: { title: "Pending Finance", value: `${values.pendingFinanceCount} deal(s)`, tone: "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-500/10 dark:border-rose-500/30 dark:text-rose-300" },
      expected_month: { title: "Expected This Month", value: money(values.expectedThisMonth), tone: "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300" },
      overdue_installments: { title: "Overdue Installments", value: `${values.overdueCount} item(s) | ${money(values.overdueAmount)}`, tone: "bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-500/10 dark:border-orange-500/30 dark:text-orange-300" },
      pending_verification: { title: "Pending Verification", value: `${values.pendingVerificationCount} deal(s)`, tone: "bg-violet-50 border-violet-200 text-violet-800 dark:bg-violet-500/10 dark:border-violet-500/30 dark:text-violet-300" },
      recent_payments: { title: "Invoices This Month", value: `${values.invoicesMtdCount} invoice(s)`, tone: "bg-cyan-50 border-cyan-200 text-cyan-800 dark:bg-cyan-500/10 dark:border-cyan-500/30 dark:text-cyan-300" },
      team_pipeline: { title: "Team Pipeline", value: `${values.teamPipelineCount} open deal(s)`, tone: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-500/10 dark:border-blue-500/30 dark:text-blue-300" },
      unassigned_leads: { title: "Unassigned Leads", value: `${values.unassignedLeads} lead(s)`, tone: "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-500/10 dark:border-yellow-500/30 dark:text-yellow-300" },
      my_pipeline: { title: "My Pipeline", value: `${values.myPipelineCount} deal(s)`, tone: "bg-indigo-50 border-indigo-200 text-indigo-800 dark:bg-indigo-500/10 dark:border-indigo-500/30 dark:text-indigo-300" },
      my_new_leads: { title: "My New Leads (7d)", value: `${values.myNewLeads7d} lead(s)`, tone: "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-800 dark:bg-fuchsia-500/10 dark:border-fuchsia-500/30 dark:text-fuchsia-300" },
    };
    const c = flat[id] || { title: id, value: "No data.", tone: "bg-foreground/5 border-foreground/10 text-foreground" };
    title = c.title;
    body = (
      <div className={`mt-3 rounded-md border p-3 ${c.tone}`}>
        <p className="text-xl font-bold text-foreground">{c.value}</p>
      </div>
    );
  }

  return (
    <article className="rounded-xl border border-foreground/10 bg-background p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {body}
    </article>
  );
}

function StatPill({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "rose" }) {
  const classes =
    tone === "emerald"
      ? "border-emerald-300/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : tone === "amber"
        ? "border-amber-300/50 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "border-rose-300/50 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  return (
    <div className={`rounded-md border px-2 py-1 ${classes}`}>
      <p className="text-[10px] uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function ChecklistRow({ label, done }: { label: string; done: boolean }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${done ? "bg-emerald-500/15 text-emerald-700" : "bg-foreground/10 text-muted"}`}>
        {done ? "✓" : "•"}
      </span>
      <span className={done ? "text-foreground" : "text-muted"}>{label}</span>
    </li>
  );
}

function HealthPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="rounded-md border border-foreground/10 px-2 py-1.5">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={`text-xs font-medium ${ok ? "text-emerald-700" : "text-amber-700"}`}>
        {ok ? "Connected" : "Needs setup"}
      </p>
    </div>
  );
}

function GuideItem({ done, title, href }: { done: boolean; title: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-md border border-foreground/10 px-3 py-2 text-sm hover:bg-foreground/[0.04]"
    >
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${done ? "bg-emerald-500/15 text-emerald-700" : "bg-foreground/10 text-muted"}`}>
          {done ? "✓" : "→"}
        </span>
        <span className={done ? "text-foreground" : "text-muted"}>{title}</span>
      </div>
      <span className="text-xs text-muted">{done ? "Done" : "Open"}</span>
    </Link>
  );
}

function SortableWidgetItem({ id, label }: { id: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "flex items-center justify-between rounded-md border border-foreground/10 bg-foreground/[0.02] px-3 py-2 text-sm",
        isDragging ? "opacity-60" : "",
      ].join(" ")}
    >
      <span className="text-foreground">{label}</span>
      <button
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
        aria-label="Drag widget"
        {...attributes}
        {...listeners}
      >
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
          <circle cx="7" cy="6" r="1.2" />
          <circle cx="13" cy="6" r="1.2" />
          <circle cx="7" cy="10" r="1.2" />
          <circle cx="13" cy="10" r="1.2" />
          <circle cx="7" cy="14" r="1.2" />
          <circle cx="13" cy="14" r="1.2" />
        </svg>
      </button>
    </div>
  );
}

function formatMoney(value: number) {
  return `NGN ${Math.round(value).toLocaleString()}`;
}

function MiniBars({ values, tone }: { values: number[]; tone: "violet" | "indigo" }) {
  const max = Math.max(1, ...values);
  const color = tone === "violet" ? "bg-violet-500/80" : "bg-indigo-500/80";
  return (
    <div className="mt-2 flex h-8 items-end gap-1">
      {values.map((v, idx) => (
        <div key={`${tone}-${idx}`} className={`w-full rounded-sm ${color}`} style={{ height: `${Math.max(12, (v / max) * 100)}%` }} />
      ))}
    </div>
  );
}
