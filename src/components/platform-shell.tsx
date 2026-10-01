"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PlatformHeaderActions } from "@/components/platform-header-actions";
import { RealcorpLogoLink } from "@/components/realcorp-brand";

const NAV = [
  { href: "/platform", label: "Tenants", match: "tenants" },
  { href: "/platform/payroll", label: "Payroll", match: "prefix" },
  { href: "/platform/settings", label: "Settings", match: "prefix" },
  { href: "/platform/onboarding", label: "Onboard org", match: "prefix" },
  { href: "/platform/errors", label: "Error lookup", match: "prefix" },
] as const;

function isActive(pathname: string, href: string, match: "tenants" | "prefix") {
  if (match === "tenants") {
    return pathname === "/platform" || pathname.startsWith("/platform/tenants");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PlatformShell({ userLabel, children }: { userLabel: string; children: ReactNode }) {
  const pathname = usePathname() || "/platform";

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-foreground/10 bg-background md:flex">
        <div className="border-b border-foreground/10 px-4 py-4">
          <RealcorpLogoLink href="/platform" subtitle="Platform admin" showWordmark />
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Platform">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href, item.match);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "rounded-md px-3 py-2 text-sm font-medium",
                  active
                    ? "bg-foreground text-background"
                    : "text-muted hover:bg-foreground/[0.06] hover:text-foreground",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/"
            className="mt-auto rounded-md px-3 py-2 text-sm text-muted hover:bg-foreground/[0.06] hover:text-foreground"
          >
            Marketing site
          </Link>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-foreground/10 bg-background">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="md:hidden">
              <RealcorpLogoLink href="/platform" subtitle="Platform admin" showWordmark />
            </div>
            <p className="hidden text-sm font-medium text-foreground md:block">Platform admin</p>
            <PlatformHeaderActions userLabel={userLabel} />
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:hidden" aria-label="Platform">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href, item.match);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium",
                    active ? "bg-foreground text-background" : "text-muted",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
