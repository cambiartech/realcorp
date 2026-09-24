"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buildShortletsNavItems, type ShortletsNavAccess } from "@/lib/shortlets-nav-items";

type Props = {
  tenantSlug: string;
  canManage: boolean;
  canHousekeeping: boolean;
  canPostFolio: boolean;
  canSettings: boolean;
  canReports: boolean;
};

export function ShortletsSubnav({
  tenantSlug,
  canManage,
  canHousekeeping,
  canPostFolio,
  canSettings,
  canReports,
}: Props) {
  const pathname = usePathname();
  const base = `/${tenantSlug}/shortlets`;
  const access: ShortletsNavAccess = {
    canManage,
    canHousekeeping,
    canPostFolio,
    canSettings,
    canReports,
  };
  const items = buildShortletsNavItems(base, access);

  return (
    <nav
      className="flex max-w-full flex-wrap gap-1 overflow-x-auto rounded-lg border border-foreground/10 p-0.5"
      aria-label="Short lets navigation"
    >
      {items.map((item) => {
        const href = item.href;
        const active =
          pathname === href ||
          (item.id === "front-desk" && pathname === base) ||
          (item.id === "locations" && pathname.startsWith(`${base}/locations`)) ||
          (item.id === "apartments" && pathname.startsWith(`${base}/apartments`)) ||
          (item.id === "rooms" && pathname.startsWith(`${base}/rooms`)) ||
          (item.id === "reservations" && pathname.startsWith(`${base}/reservations`));
        const Icon = item.icon;
        return (
          <Link
            key={item.id}
            href={href}
            aria-current={active ? "page" : undefined}
            className={[
              "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold",
              active ? "bg-foreground text-background" : "text-muted",
            ].join(" ")}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
