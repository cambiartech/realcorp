"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart2,
  Banknote,
  BedDouble,
  Building2,
  CalendarCheck2,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  ClipboardCheck,
  ConciergeBell,
  CreditCard,
  FileText,
  FolderOpen,
  Globe,
  Handshake,
  Landmark,
  LayoutDashboard,
  ListTodo,
  MapPin,
  Megaphone,
  MessageCircle,
  Radio,
  Receipt,
  Search,
  Settings,
  ShoppingBag,
  Star,
  TrendingDown,
  TrendingUp,
  UserCircle,
  Users,
  UsersRound,
  Home,
  type LucideIcon,
} from "lucide-react";
import type { TenantNavKey } from "@/lib/tenant-nav-access";
import type { ShortletsNavAccess } from "@/lib/shortlets-nav-items";
import { buildShortletsNavItems } from "@/lib/shortlets-nav-items";

export type TenantNavProps = {
  tenantName: string;
  tenantSlug: string;
  tenantLogoUrl?: string | null;
  canAccessPlatform: boolean;
  canManageHr?: boolean;
  /** When true, HR admins also see My dashboard (they are on payroll / have a profile). */
  hasHrEmployeeProfile?: boolean;
  visibleNavKeys: TenantNavKey[];
  /** When false, WhatsApp CRM is hidden from the Marketing menu. */
  moduleWhatsApp?: boolean;
  userName: string | null;
  userEmail: string | null;
  shortletsAccess?: ShortletsNavAccess | null;
};

type NavItem = { key: TenantNavKey; label: string; href: string; mobileLabel: string };

const ALL_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "", mobileLabel: "Dash" },
  { key: "portal", label: "My portfolio", href: "/portal", mobileLabel: "Portfolio" },
  { key: "portalShortlets", label: "My shortlets", href: "/portal/shortlets", mobileLabel: "Shortlets" },
  { key: "portalDocuments", label: "My documents", href: "/portal/documents", mobileLabel: "Documents" },
  { key: "projects", label: "Projects", href: "/projects", mobileLabel: "Projects" },
  { key: "clients", label: "Clients", href: "/clients", mobileLabel: "Clients" },
  { key: "leads", label: "Leads", href: "/leads", mobileLabel: "Leads" },
  { key: "deals", label: "Deals", href: "/deals", mobileLabel: "Deals" },
  { key: "activities", label: "Activities", href: "/activities", mobileLabel: "Activity" },
  { key: "tasks", label: "Tasks", href: "/tasks", mobileLabel: "Tasks" },
  { key: "marketing", label: "Marketing", href: "/marketing", mobileLabel: "Marketing" },
  { key: "listings", label: "Listings", href: "/listings", mobileLabel: "Listings" },
  { key: "stakeholders", label: "Stakeholders", href: "/stakeholders", mobileLabel: "Stakeholders" },
  { key: "community", label: "Community", href: "/community", mobileLabel: "Community" },
  { key: "shortlets", label: "Short Lets", href: "/shortlets", mobileLabel: "Shortlets" },
  { key: "finance", label: "Finance", href: "/finance", mobileLabel: "Finance" },
  { key: "hr", label: "People", href: "/hr", mobileLabel: "HR" },
  { key: "team", label: "Team", href: "/team", mobileLabel: "Team" },
  { key: "settings", label: "Settings", href: "/settings", mobileLabel: "Settings" },
];

const NAV_ICONS: Record<TenantNavKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  portal: TrendingUp,
  portalShortlets: BedDouble,
  portalDocuments: FileText,
  projects: FolderOpen,
  clients: Building2,
  leads: Search,
  deals: CalendarCheck2,
  activities: Activity,
  tasks: ListTodo,
  marketing: Megaphone,
  listings: Globe,
  stakeholders: Handshake,
  community: Users,
  shortlets: Home,
  finance: CircleDollarSign,
  hr: UsersRound,
  team: Users,
  settings: Settings,
};

/** Keys that live inside the collapsible Sales group */
const SALES_GROUP_KEYS: TenantNavKey[] = ["leads", "deals"];

/** Keys that render as top-level items (no group) */
const TOP_LEVEL_KEYS: TenantNavKey[] = [
  "dashboard",
  "portal",
  "portalShortlets",
  "portalDocuments",
  "projects",
  "clients",
  "tasks",
  "stakeholders",
  "community",
  "team",
  "settings",
];

type FinanceSubItem = { id: string; label: string; href: string; icon: LucideIcon };

function useCoreNavItems(tenantSlug: string, visibleNavKeys: TenantNavKey[]) {
  return useMemo(() => {
    const visible = new Set(visibleNavKeys);
    return ALL_ITEMS.filter((item) => visible.has(item.key)).map((item) => ({
      ...item,
      href: `/${tenantSlug}${item.href}`,
    }));
  }, [tenantSlug, visibleNavKeys]);
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  const isTenantRoot = href.split("/").length === 2 && href.startsWith("/");
  if (isTenantRoot) return pathname === href;

  // Portal hub is only active on /portal and /portal/projects/* — not /portal/shortlets or /portal/documents
  if (href.endsWith("/portal")) {
    if (pathname.startsWith(`${href}/shortlets`) || pathname.startsWith(`${href}/documents`)) {
      return false;
    }
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function tenantInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function TenantBrandLink({
  href,
  tenantName,
  logoUrl,
}: {
  href: string;
  tenantName: string;
  logoUrl?: string | null;
}) {
  const mark = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt="" className="h-8 w-auto max-w-[120px] shrink-0 object-contain" />
  ) : (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-foreground/15 bg-foreground/[0.04] text-xs font-bold text-foreground">
      {tenantInitials(tenantName)}
    </span>
  );

  return (
    <Link href={href} className="group inline-flex min-w-0 items-center gap-2">
      {mark}
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold tracking-tight text-foreground group-hover:opacity-90">
          {tenantName}
        </span>
        <span className="block text-[10px] text-muted">Organization</span>
      </span>
    </Link>
  );
}

/** Desktop sidebar only */
export function TenantSidebar({
  tenantName,
  tenantSlug,
  tenantLogoUrl = null,
  canAccessPlatform,
  canManageHr = false,
  hasHrEmployeeProfile = false,
  visibleNavKeys,
  moduleWhatsApp = true,
  userName,
  userEmail,
  shortletsAccess = null,
}: TenantNavProps) {
  const pathname = usePathname();
  const coreItems = useCoreNavItems(tenantSlug, visibleNavKeys);

  const [collapsed, setCollapsed] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);
  const [marketingOpen, setMarketingOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [hrOpen, setHrOpen] = useState(false);
  const [shortletsOpen, setShortletsOpen] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem("tenant-nav-collapsed") === "1") setCollapsed(true);
      const stored = window.localStorage.getItem("tenant-nav-sales-open");
      if (stored === "1") setSalesOpen(true);
      else if (stored === "0") setSalesOpen(false);
      const storedMarketing = window.localStorage.getItem("tenant-nav-marketing-open");
      if (storedMarketing === "1") setMarketingOpen(true);
      else if (storedMarketing === "0") setMarketingOpen(false);
      const storedFinance = window.localStorage.getItem("tenant-nav-finance-open");
      if (storedFinance === "1") setFinanceOpen(true);
      else if (storedFinance === "0") setFinanceOpen(false);
      const storedHr = window.localStorage.getItem("tenant-nav-hr-open");
      if (storedHr === "1") setHrOpen(true);
      else if (storedHr === "0") setHrOpen(false);
      const storedShortlets = window.localStorage.getItem("tenant-nav-shortlets-open");
      if (storedShortlets === "1") setShortletsOpen(true);
      else if (storedShortlets === "0") setShortletsOpen(false);
    } catch {
      // ignore
    }
  }, []);

  // Auto-expand Sales group when a sales route is active
  useEffect(() => {
    const salesItems = coreItems.filter((i) => SALES_GROUP_KEYS.includes(i.key as TenantNavKey));
    const anyActive = salesItems.some((i) => isActive(pathname, i.href));
    if (anyActive) setSalesOpen(true);
  }, [pathname, coreItems]);

  useEffect(() => {
    const financeItem = coreItems.find((i) => i.key === "finance");
    if (!financeItem) return;
    if (pathname === financeItem.href || pathname.startsWith(`${financeItem.href}/`)) setFinanceOpen(true);
  }, [pathname, coreItems]);

  useEffect(() => {
    const marketingItem = coreItems.find((i) => i.key === "marketing");
    const listingsItem = coreItems.find((i) => i.key === "listings");
    const activitiesItem = coreItems.find((i) => i.key === "activities");
    const onMarketing =
      (marketingItem && (pathname === marketingItem.href || pathname.startsWith(`${marketingItem.href}/`))) ||
      (listingsItem && (pathname === listingsItem.href || pathname.startsWith(`${listingsItem.href}/`))) ||
      (activitiesItem &&
        moduleWhatsApp !== false &&
        (pathname === activitiesItem.href || pathname.startsWith(`${activitiesItem.href}`)) &&
        (pathname.includes("channel=whatsapp") || pathname.includes("whatsapp")));
    if (onMarketing) setMarketingOpen(true);
  }, [pathname, coreItems, moduleWhatsApp]);

  useEffect(() => {
    const hrNavItem = coreItems.find((i) => i.key === "hr");
    if (!hrNavItem) return;
    if (pathname === hrNavItem.href || pathname.startsWith(`${hrNavItem.href}/`)) setHrOpen(true);
  }, [pathname, coreItems]);

  useEffect(() => {
    const shortletsItem = coreItems.find((i) => i.key === "shortlets");
    if (!shortletsItem) return;
    if (pathname === shortletsItem.href || pathname.startsWith(`${shortletsItem.href}/`))
      setShortletsOpen(true);
  }, [pathname, coreItems]);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem("tenant-nav-collapsed", next ? "1" : "0");
      return next;
    });
  }

  function toggleSales() {
    setSalesOpen((prev) => {
      const next = !prev;
      window.localStorage.setItem("tenant-nav-sales-open", next ? "1" : "0");
      return next;
    });
  }

  function toggleFinance() {
    setFinanceOpen((prev) => {
      const next = !prev;
      window.localStorage.setItem("tenant-nav-finance-open", next ? "1" : "0");
      return next;
    });
  }

  function toggleMarketing() {
    setMarketingOpen((prev) => {
      const next = !prev;
      window.localStorage.setItem("tenant-nav-marketing-open", next ? "1" : "0");
      return next;
    });
  }

  function toggleHr() {
    setHrOpen((prev) => {
      const next = !prev;
      window.localStorage.setItem("tenant-nav-hr-open", next ? "1" : "0");
      return next;
    });
  }

  function toggleShortlets() {
    setShortletsOpen((prev) => {
      const next = !prev;
      window.localStorage.setItem("tenant-nav-shortlets-open", next ? "1" : "0");
      return next;
    });
  }

  const topLevelItems = coreItems.filter((i) => TOP_LEVEL_KEYS.includes(i.key as TenantNavKey));
  const salesItems = coreItems.filter((i) => SALES_GROUP_KEYS.includes(i.key as TenantNavKey));
  const hasSalesItems = salesItems.length > 0;
  const marketingItem = coreItems.find((i) => i.key === "marketing");
  const listingsItem = coreItems.find((i) => i.key === "listings");
  const activitiesItem = coreItems.find((i) => i.key === "activities");
  const marketingSubItems: FinanceSubItem[] = [];
  if (marketingItem) {
    marketingSubItems.push({
      id: "campaigns",
      label: "Campaigns",
      href: marketingItem.href,
      icon: Megaphone,
    });
  }
  if (activitiesItem && moduleWhatsApp !== false && (marketingItem || listingsItem)) {
    marketingSubItems.push({
      id: "whatsapp",
      label: "WhatsApp CRM",
      href: `${activitiesItem.href}?channel=whatsapp`,
      icon: MessageCircle,
    });
  }
  if (listingsItem) {
    marketingSubItems.push({
      id: "listings",
      label: "Public listings",
      href: listingsItem.href,
      icon: Globe,
    });
  }
  const hasMarketingItems = marketingSubItems.length > 0;
  const financeItem = coreItems.find((i) => i.key === "finance");
  const financeSubItems: FinanceSubItem[] = financeItem
    ? [
        { id: "overview", label: "Overview", href: `${financeItem.href}/overview`, icon: LayoutDashboard },
        {
          id: "receivables",
          label: "Receivables",
          href: `${financeItem.href}/receivables`,
          icon: TrendingUp,
        },
        { id: "payables", label: "Payables", href: `${financeItem.href}/payables`, icon: TrendingDown },
        {
          id: "sales-receipts",
          label: "Sales Receipts",
          href: `${financeItem.href}/sales-receipts`,
          icon: Receipt,
        },
        { id: "documents", label: "Documents", href: `${financeItem.href}/documents`, icon: FileText },
        { id: "invoices", label: "Invoices", href: `${financeItem.href}/invoices`, icon: CreditCard },
        { id: "payments", label: "Payments", href: `${financeItem.href}/payments`, icon: Banknote },
        { id: "expenses", label: "Expenses", href: `${financeItem.href}/expenses`, icon: ShoppingBag },
        { id: "banking", label: "Banking", href: `${financeItem.href}/banking`, icon: Landmark },
        { id: "reports", label: "Reports", href: `${financeItem.href}/reports`, icon: BarChart2 },
        {
          id: "shortlets",
          label: "Income per project & shortlet",
          href: `${financeItem.href}/shortlets`,
          icon: BedDouble,
        },
        {
          id: "audit-logs",
          label: "Audit Logs",
          href: `${financeItem.href}/audit-logs`,
          icon: ClipboardList,
        },
        { id: "settings", label: "Settings", href: `${financeItem.href}/settings`, icon: Settings },
      ]
    : [];
  const hrItem = coreItems.find((i) => i.key === "hr");
  const hrSubItems: FinanceSubItem[] = hrItem
    ? canManageHr
      ? [
          { id: "people", label: "People", href: `${hrItem.href}/people`, icon: Users },
          { id: "leave", label: "Leave tracker", href: `${hrItem.href}/leave`, icon: CalendarDays },
          { id: "payslips", label: "Payslips", href: `${hrItem.href}/payslips`, icon: Banknote },
          { id: "remittances", label: "Remittances", href: `${hrItem.href}/remittances`, icon: Landmark },
          { id: "appraisals", label: "Appraisals", href: `${hrItem.href}/appraisals`, icon: Star },
          { id: "documents", label: "Documents", href: `${hrItem.href}/documents`, icon: FileText },
          { id: "insights", label: "Insights", href: `${hrItem.href}/insights`, icon: BarChart2 },
          ...(hasHrEmployeeProfile
            ? [{ id: "my", label: "My dashboard", href: `${hrItem.href}/dashboard`, icon: UserCircle }]
            : []),
        ]
      : [
          { id: "my", label: "My dashboard", href: `${hrItem.href}/dashboard`, icon: UserCircle },
          { id: "leave", label: "Leave tracker", href: `${hrItem.href}/leave`, icon: CalendarDays },
        ]
    : [];
  const hasFinanceItems = financeSubItems.length > 0;
  const hasHrItems = hrSubItems.length > 0;
  const shortletsItem = coreItems.find((i) => i.key === "shortlets");
  const shortletsSubItems: FinanceSubItem[] = shortletsItem
    ? buildShortletsNavItems(shortletsItem.href, shortletsAccess ?? {
        canManage: false,
        canHousekeeping: false,
        canPostFolio: false,
        canSettings: false,
        canReports: false,
      }).map((item) => ({
        id: item.id,
        label: item.label,
        href: item.href,
        icon: item.icon,
      }))
    : [];
  const hasShortletsItems = shortletsSubItems.length > 0;

  function isMarketingSubActive(id: string) {
    if (id === "campaigns" && marketingItem) {
      return pathname === marketingItem.href || pathname.startsWith(`${marketingItem.href}/`);
    }
    if (id === "whatsapp" && activitiesItem) {
      return (
        pathname === activitiesItem.href ||
        pathname.startsWith(`${activitiesItem.href}?`) ||
        pathname.startsWith(`${activitiesItem.href}/`)
      );
    }
    if (id === "listings" && listingsItem) {
      return pathname === listingsItem.href || pathname.startsWith(`${listingsItem.href}/`);
    }
    return false;
  }

  function isFinanceSubActive(id: string) {
    if (!financeItem) return false;
    const base = `${financeItem.href}/`;
    const onFinance = pathname.startsWith(base);
    if (!onFinance) return false;
    return pathname === `${financeItem.href}/${id}`;
  }

  function isHrSubActive(id: string) {
    if (!hrItem) return false;
    const base = `${hrItem.href}/`;
    if (!pathname.startsWith(base)) return false;
    if (id === "my") {
      return (
        pathname === `${hrItem.href}/dashboard` ||
        pathname.startsWith(`${hrItem.href}/dashboard?`) ||
        pathname === `${hrItem.href}/my` ||
        pathname.startsWith(`${hrItem.href}/my?`)
      );
    }
    return pathname === `${hrItem.href}/${id}`;
  }

  function isShortletsSubActive(id: string) {
    if (!shortletsItem) return false;
    const base = `${shortletsItem.href}/`;
    if (!pathname.startsWith(base) && pathname !== shortletsItem.href) return false;
    if (id === "front-desk") {
      return pathname === shortletsItem.href || pathname === `${shortletsItem.href}/front-desk`;
    }
    if (id === "locations" || id === "apartments") {
      return (
        pathname === `${shortletsItem.href}/${id}` || pathname.startsWith(`${shortletsItem.href}/${id}/`)
      );
    }
    return pathname === `${shortletsItem.href}/${id}`;
  }

  const utilityItems = useMemo(() => {
    const u: { label: string; href: string }[] = [];
    if (canAccessPlatform) u.push({ label: "Platform", href: "/platform" });
    u.push({ label: "Home", href: "/" });
    return u;
  }, [canAccessPlatform]);

  const displayName = userName?.trim() || userEmail?.split("@")[0]?.trim() || "Account";
  const emailDisplay = userEmail?.trim() || "";
  const initial = (displayName || emailDisplay || "?").charAt(0).toUpperCase();

  // Separate dashboard + projects from the rest of topLevel
  const preGroupKeys: TenantNavKey[] = ["dashboard", "portal", "projects"];
  const preGroupItems = topLevelItems.filter((i) => preGroupKeys.includes(i.key));
  const postGroupItems = topLevelItems.filter((i) => !preGroupKeys.includes(i.key));

  return (
    <aside
      className={[
        "hidden min-h-0 shrink-0 flex-col self-stretch border-r border-foreground/10 bg-foreground/[0.02] transition-[width] duration-200 md:flex",
        collapsed ? "w-20" : "w-64",
      ].join(" ")}
    >
      <div className="flex min-h-0 flex-1 flex-col px-4 py-5">
        <div
          className={
            collapsed ? "flex shrink-0 justify-center" : "flex shrink-0 items-start justify-between gap-2"
          }
        >
          {collapsed ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-foreground/15 hover:bg-foreground/[0.06]"
              title={`${tenantName} — expand sidebar`}
              aria-label="Expand sidebar"
            >
              {tenantLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tenantLogoUrl} alt="" className="h-6 w-auto max-w-[28px] object-contain" />
              ) : (
                <span className="text-[10px] font-bold text-foreground">{tenantInitials(tenantName)}</span>
              )}
            </button>
          ) : (
            <>
              <TenantBrandLink
                href={coreItems.find((i) => i.key === "dashboard")?.href ?? `/${tenantSlug}`}
                tenantName={tenantName}
                logoUrl={tenantLogoUrl}
              />
              <button
                type="button"
                onClick={toggleCollapsed}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
            </>
          )}
        </div>

        <nav
          className="mt-6 min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-1"
          aria-label="Workspace navigation"
        >
          {/* Dashboard + Projects always at top */}
          {preGroupItems.map((item) => (
            <NavLink
              key={item.key}
              navKey={item.key}
              href={item.href}
              label={item.label}
              active={isActive(pathname, item.href)}
              collapsed={collapsed}
            />
          ))}

          {/* Sales group */}
          {hasSalesItems ? (
            <div className="pt-1">
              {collapsed ? null : (
                <button
                  type="button"
                  onClick={toggleSales}
                  className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-muted transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                >
                  <span>Sales</span>
                  <ChevronDown
                    className={[
                      "h-3.5 w-3.5 transition-transform duration-150",
                      salesOpen ? "" : "-rotate-90",
                    ].join(" ")}
                    strokeWidth={2}
                  />
                </button>
              )}
              {collapsed || salesOpen ? (
                <div className={collapsed ? "space-y-1" : "mt-0.5 space-y-0.5 pl-3"}>
                  {salesItems.map((item) => (
                    <NavLink
                      key={item.key}
                      navKey={item.key}
                      href={item.href}
                      label={item.label}
                      active={isActive(pathname, item.href)}
                      collapsed={collapsed}
                      indented={!collapsed}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Marketing group */}
          {hasMarketingItems ? (
            <div className="pt-1">
              {collapsed ? (
                <NavLink
                  navKey="marketing"
                  href={marketingSubItems[0]?.href ?? `/${tenantSlug}/marketing`}
                  label="Marketing"
                  active={marketingSubItems.some((item) => isMarketingSubActive(item.id))}
                  collapsed={true}
                />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={toggleMarketing}
                    className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-muted transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                  >
                    <span>Marketing</span>
                    <ChevronDown
                      className={[
                        "h-3.5 w-3.5 transition-transform duration-150",
                        marketingOpen ? "" : "-rotate-90",
                      ].join(" ")}
                      strokeWidth={2}
                    />
                  </button>
                  {marketingOpen ? (
                    <div className="mt-0.5 space-y-0.5 pl-3">
                      {marketingSubItems.map((item) => (
                        <SubNavLink
                          key={item.id}
                          href={item.href}
                          label={item.label}
                          icon={item.icon}
                          active={isMarketingSubActive(item.id)}
                        />
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {/* Finance group */}
          {hasFinanceItems && financeItem ? (
            <div className="pt-1">
              {collapsed ? (
                // Collapsed: single Finance icon linking to finance root
                <NavLink
                  navKey="finance"
                  href={financeItem.href}
                  label="Finance"
                  active={pathname === financeItem.href || pathname.startsWith(`${financeItem.href}/`)}
                  collapsed={true}
                />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={toggleFinance}
                    className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-muted transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                  >
                    <span>Finance</span>
                    <ChevronDown
                      className={[
                        "h-3.5 w-3.5 transition-transform duration-150",
                        financeOpen ? "" : "-rotate-90",
                      ].join(" ")}
                      strokeWidth={2}
                    />
                  </button>
                  {financeOpen ? (
                    <div className="mt-0.5 space-y-0.5 pl-3">
                      {financeSubItems.map((item) => (
                        <SubNavLink
                          key={item.id}
                          href={item.href}
                          label={item.label}
                          icon={item.icon}
                          active={isFinanceSubActive(item.id)}
                        />
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {/* HR group */}
          {hasHrItems && hrItem ? (
            <div className="pt-1">
              {collapsed ? (
                // Collapsed: single HR icon linking to hr root
                <NavLink
                  navKey="hr"
                  href={hrItem.href}
                  label={canManageHr ? "People" : "My HR"}
                  active={pathname === hrItem.href || pathname.startsWith(`${hrItem.href}/`)}
                  collapsed={true}
                />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={toggleHr}
                    className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-muted transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                  >
                    <span>{canManageHr ? "People" : "My HR"}</span>
                    <ChevronDown
                      className={[
                        "h-3.5 w-3.5 transition-transform duration-150",
                        hrOpen ? "" : "-rotate-90",
                      ].join(" ")}
                      strokeWidth={2}
                    />
                  </button>
                  {hrOpen ? (
                    <div className="mt-0.5 space-y-0.5 pl-3">
                      {hrSubItems.map((item) => (
                        <SubNavLink
                          key={item.id}
                          href={item.href}
                          label={item.label}
                          icon={item.icon}
                          active={isHrSubActive(item.id)}
                        />
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {/* Short Lets group */}
          {hasShortletsItems && shortletsItem ? (
            <div className="pt-1">
              {collapsed ? (
                <NavLink
                  navKey="shortlets"
                  href={`${shortletsItem.href}/front-desk`}
                  label="Short Lets"
                  active={pathname === shortletsItem.href || pathname.startsWith(`${shortletsItem.href}/`)}
                  collapsed={true}
                />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={toggleShortlets}
                    className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-muted transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                  >
                    <span>Short Lets</span>
                    <ChevronDown
                      className={[
                        "h-3.5 w-3.5 transition-transform duration-150",
                        shortletsOpen ? "" : "-rotate-90",
                      ].join(" ")}
                      strokeWidth={2}
                    />
                  </button>
                  {shortletsOpen ? (
                    <div className="mt-0.5 space-y-0.5 pl-3">
                      {shortletsSubItems.map((item) => (
                        <SubNavLink
                          key={item.id}
                          href={item.href}
                          label={item.label}
                          icon={item.icon}
                          active={isShortletsSubActive(item.id)}
                        />
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {/* Remaining top-level items */}
          {postGroupItems.length > 0 ? (
            <div
              className={
                hasSalesItems || hasMarketingItems || hasFinanceItems || hasHrItems || hasShortletsItems
                  ? "pt-1"
                  : ""
              }
            >
              {!collapsed &&
              (hasSalesItems || hasMarketingItems || hasFinanceItems || hasHrItems || hasShortletsItems) ? (
                <div className="mb-1 border-t border-foreground/10" />
              ) : null}
              {visibleNavKeys.includes("portal") ? (
                <NavLink
                  navKey="portal"
                  href="/investor"
                  label="All investments"
                  active={pathname === "/investor"}
                  collapsed={collapsed}
                />
              ) : null}
              {postGroupItems.map((item) => (
                <NavLink
                  key={item.key}
                  navKey={item.key}
                  href={item.href}
                  label={item.label}
                  active={isActive(pathname, item.href)}
                  collapsed={collapsed}
                />
              ))}
            </div>
          ) : null}
        </nav>

        <div className="mt-6 shrink-0 border-t border-foreground/10 pt-4">
          <nav className="space-y-1" aria-label="Shortcuts">
            {utilityItems.map((item) => (
              <NavLink
                key={item.href}
                navKey={item.label === "Platform" ? "settings" : "dashboard"}
                href={item.href}
                label={item.label}
                active={isActive(pathname, item.href)}
                collapsed={collapsed}
              />
            ))}
          </nav>
        </div>
      </div>

      <SidebarProfileFooter
        collapsed={collapsed}
        displayName={displayName}
        emailDisplay={emailDisplay}
        initial={initial}
      />
    </aside>
  );
}

/** Fixed bottom bar on small screens */
export function TenantMobileDock({
  tenantSlug,
  canAccessPlatform,
  canManageHr = false,
  visibleNavKeys,
}: Pick<TenantNavProps, "tenantSlug" | "canAccessPlatform" | "canManageHr" | "visibleNavKeys">) {
  const pathname = usePathname();
  const coreItems = useCoreNavItems(tenantSlug, visibleNavKeys);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-foreground/10 bg-background/95 backdrop-blur md:hidden"
      aria-label="Mobile workspace navigation"
    >
      <div className="flex gap-0.5 overflow-x-auto px-1 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {coreItems.map((item) => (
          <MobileItem
            key={item.key}
            navKey={item.key}
            label={item.mobileLabel}
            href={item.href}
            active={isActive(pathname, item.href)}
          />
        ))}
        {canAccessPlatform ? (
          <MobileItem
            navKey="settings"
            label="Platform"
            href="/platform"
            active={isActive(pathname, "/platform")}
          />
        ) : null}
        <MobileItem navKey="dashboard" label="Home" href="/" active={isActive(pathname, "/")} />
      </div>
    </nav>
  );
}

function SidebarProfileFooter({
  collapsed,
  displayName,
  emailDisplay,
  initial,
}: {
  collapsed: boolean;
  displayName: string;
  emailDisplay: string;
  initial: string;
}) {
  const title = [displayName, emailDisplay].filter(Boolean).join(" · ");

  if (collapsed) {
    return (
      <div className="flex shrink-0 justify-center border-t border-foreground/10 bg-foreground/[0.04] py-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground/10 text-sm font-semibold text-foreground"
          title={title}
          aria-label={emailDisplay ? `${displayName}, ${emailDisplay}` : displayName}
        >
          {initial}
        </div>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t border-foreground/10 bg-foreground/[0.04] px-4 py-3">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-sm font-semibold text-foreground"
          aria-hidden
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
          {emailDisplay ? <p className="truncate text-xs text-muted">{emailDisplay}</p> : null}
        </div>
      </div>
    </div>
  );
}

function NavLink({
  navKey,
  href,
  label,
  active,
  collapsed,
  indented,
}: {
  navKey: TenantNavKey;
  href: string;
  label: string;
  active: boolean;
  collapsed: boolean;
  indented?: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={[
        // A solid black pill for every active item made the whole sidebar
        // shout. A tinted row with a copper edge reads as "you are here"
        // without competing with the page content.
        "relative block rounded-md px-3 py-2 text-sm transition-colors",
        collapsed ? "text-center" : "",
        indented ? "py-1.5 text-[0.8125rem]" : "",
        active
          ? "bg-[var(--field)] font-semibold text-foreground before:absolute before:left-0 before:top-1/2 before:h-[18px] before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-[var(--accent)] before:content-['']"
          : "text-muted hover:bg-[var(--field)] hover:text-foreground",
      ].join(" ")}
    >
      {collapsed ? (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded border border-current/35">
          <NavIcon navKey={navKey} className="h-3.5 w-3.5" />
        </span>
      ) : (
        <span className="inline-flex items-center gap-2">
          <NavIcon navKey={navKey} className="h-4 w-4" />
          <span>{label}</span>
        </span>
      )}
    </Link>
  );
}

function MobileItem({
  href,
  label,
  active,
  navKey,
}: {
  href: string;
  label: string;
  active: boolean;
  navKey: TenantNavKey;
}) {
  const Icon = NAV_ICONS[navKey] ?? LayoutDashboard;
  return (
    <Link
      href={href}
      title={label}
      className={[
        "inline-flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-md px-2.5 py-1.5 transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted hover:bg-foreground/[0.06] hover:text-foreground",
      ].join(" ")}
    >
      <Icon className="h-5 w-5" strokeWidth={1.9} />
      <span className="text-[9px] font-medium leading-none">{label}</span>
    </Link>
  );
}

function SubNavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={[
        "flex items-center gap-2 rounded-md px-3 py-1.5 text-[0.8125rem] transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted hover:bg-foreground/[0.06] hover:text-foreground",
      ].join(" ")}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
      <span>{label}</span>
    </Link>
  );
}

function NavIcon({ navKey, className }: { navKey: TenantNavKey; className?: string }) {
  const Icon = NAV_ICONS[navKey];
  return <Icon className={className || "h-4 w-4"} strokeWidth={1.9} />;
}
