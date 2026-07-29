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
    <nav className="border-b border-foreground/10" aria-label="Short lets navigation">
      <div className="flex gap-1 overflow-x-auto pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const href = item.href;
          const active =
            pathname === href ||
            (item.id === "front-desk" && pathname === base) ||
            (item.id === "locations" && pathname.startsWith(`${base}/locations`)) ||
            (item.id === "apartments" && pathname.startsWith(`${base}/apartments`)) ||
            (item.id === "reservations" && pathname.startsWith(`${base}/reservations`));
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={href}
              className={[
                "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors",
                active
                  ? "border-foreground font-semibold text-foreground"
                  : "border-transparent text-muted hover:border-foreground/20 hover:text-foreground",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" strokeWidth={1.9} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
