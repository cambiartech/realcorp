"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { TenantNavKey } from "@/lib/tenant-nav-access";

export type TenantNavProps = {
  tenantName: string;
  tenantSlug: string;
  canAccessPlatform: boolean;
  visibleNavKeys: TenantNavKey[];
  userName: string | null;
  userEmail: string | null;
};

type NavItem = { key: TenantNavKey; label: string; href: string; mobileLabel: string };

const ALL_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "", mobileLabel: "Dash" },
  { key: "projects", label: "Projects", href: "/projects", mobileLabel: "Projects" },
  { key: "leads", label: "Leads", href: "/leads", mobileLabel: "Leads" },
  { key: "deals", label: "Deals", href: "/deals", mobileLabel: "Deals" },
  { key: "marketing", label: "Marketing", href: "/marketing", mobileLabel: "Marketing" },
  { key: "community", label: "Community", href: "/community", mobileLabel: "Community" },
  { key: "finance", label: "Finance", href: "/finance", mobileLabel: "Finance" },
  { key: "team", label: "Team", href: "/team", mobileLabel: "Team" },
  { key: "settings", label: "Settings", href: "/settings", mobileLabel: "Settings" },
];

function useCoreNavItems(tenantSlug: string, visibleNavKeys: TenantNavKey[]) {
  return useMemo(() => {
    const visible = new Set(visibleNavKeys);
    return ALL_ITEMS.filter((item) => visible.has(item.key)).map((item) => ({
      ...item,
      href: `/${tenantSlug}${item.href}`,
    }));
  }, [tenantSlug, visibleNavKeys]);
}

/** Desktop sidebar only — must be a direct flex child of the main shell row (not wrapped with mobile nav). */
export function TenantSidebar({
  tenantName,
  tenantSlug,
  canAccessPlatform,
  visibleNavKeys,
  userName,
  userEmail,
}: TenantNavProps) {
  const pathname = usePathname();
  const coreItems = useCoreNavItems(tenantSlug, visibleNavKeys);

  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem("tenant-nav-collapsed") === "1") setCollapsed(true);
    } catch {
      // ignore
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem("tenant-nav-collapsed", next ? "1" : "0");
      return next;
    });
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

  return (
    <aside
      className={[
        "hidden min-h-0 shrink-0 flex-col self-stretch border-r border-foreground/10 bg-foreground/[0.02] transition-[width] duration-200 md:flex",
        collapsed ? "w-20" : "w-64",
      ].join(" ")}
    >
      <div className="flex min-h-0 flex-1 flex-col px-4 py-5">
        <div className={collapsed ? "flex shrink-0 justify-center" : "flex shrink-0 items-start justify-between gap-2"}>
          {collapsed ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          ) : (
            <>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted">Tenant</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{tenantName}</p>
              </div>
              <button
                type="button"
                onClick={toggleCollapsed}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
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
          {coreItems.map((item) => (
            <NavLink
              key={item.key}
              href={item.href}
              label={item.label}
              active={isActive(pathname, item.href)}
              collapsed={collapsed}
            />
          ))}
        </nav>

        <div className="mt-6 shrink-0 border-t border-foreground/10 pt-4">
          <nav className="space-y-1" aria-label="Shortcuts">
            {utilityItems.map((item) => (
              <NavLink
                key={item.href}
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

/** Fixed bottom bar on small screens — render outside the main flex row so it does not affect sidebar height. */
export function TenantMobileDock({
  tenantSlug,
  canAccessPlatform,
  visibleNavKeys,
}: Pick<TenantNavProps, "tenantSlug" | "canAccessPlatform" | "visibleNavKeys">) {
  const pathname = usePathname();
  const coreItems = useCoreNavItems(tenantSlug, visibleNavKeys);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-foreground/10 bg-background/95 backdrop-blur md:hidden"
      aria-label="Mobile workspace navigation"
    >
      <div className="flex gap-1 overflow-x-auto px-2 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {coreItems.map((item) => (
          <MobileItem
            key={item.key}
            label={item.mobileLabel}
            href={item.href}
            active={isActive(pathname, item.href)}
          />
        ))}
        {canAccessPlatform ? (
          <MobileItem label="Platform" href="/platform" active={isActive(pathname, "/platform")} />
        ) : null}
        <MobileItem label="Site" href="/" active={isActive(pathname, "/")} />
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

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  const isTenantRoot = href.split("/").length === 2 && href.startsWith("/");
  if (isTenantRoot) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  label,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={[
        "block rounded-md px-3 py-2 text-sm transition-colors",
        collapsed ? "text-center" : "",
        active ? "bg-foreground text-background" : "text-muted hover:bg-foreground/[0.06] hover:text-foreground",
      ].join(" ")}
    >
      {collapsed ? (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded border border-current/35 text-xs">
          {label.slice(0, 1)}
        </span>
      ) : (
        label
      )}
    </Link>
  );
}

function MobileItem({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex shrink-0 items-center justify-center rounded-md px-2.5 py-2 text-xs font-medium transition-colors",
        active ? "bg-foreground text-background" : "text-muted hover:bg-foreground/[0.06] hover:text-foreground",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}
