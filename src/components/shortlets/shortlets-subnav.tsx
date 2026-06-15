"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart2,
  BedDouble,
  CalendarDays,
  ConciergeBell,
  Radio,
  Receipt,
  Settings,
} from "lucide-react";

type Props = {
  tenantSlug: string;
  canManage: boolean;
  canHousekeeping: boolean;
  canPostFolio: boolean;
  canSettings: boolean;
  canReports: boolean;
};

type SubItem = {
  id: string;
  label: string;
  icon: typeof ConciergeBell;
  show: boolean;
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

  const items: SubItem[] = [
    { id: "front-desk", label: "Front desk", icon: ConciergeBell, show: canManage },
    { id: "rooms", label: "Room board", icon: BedDouble, show: canManage || canHousekeeping },
    { id: "reservations", label: "Reservations", icon: CalendarDays, show: canManage },
    { id: "channels", label: "Channels", icon: Radio, show: canManage },
    { id: "folio", label: "Guest bill", icon: Receipt, show: canPostFolio },
    { id: "reports", label: "Reports", icon: BarChart2, show: canReports },
    { id: "settings", label: "Settings", icon: Settings, show: canSettings },
  ].filter((i) => i.show);

  return (
    <nav className="border-b border-foreground/10" aria-label="Short lets navigation">
      <div className="flex gap-1 overflow-x-auto pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const href = `${base}/${item.id}`;
          const active = pathname === href || (item.id === "front-desk" && pathname === base);
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
