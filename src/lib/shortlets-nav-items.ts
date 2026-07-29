import type { LucideIcon } from "lucide-react";
import {
  BarChart2,
  BedDouble,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ConciergeBell,
  MapPin,
  Radio,
  Receipt,
  Settings,
  Users,
} from "lucide-react";

export type ShortletsNavAccess = {
  canManage: boolean;
  canHousekeeping: boolean;
  canPostFolio: boolean;
  canSettings: boolean;
  canReports: boolean;
};

export type ShortletsNavItem = {
  id: string;
  label: string;
  hrefSuffix: string;
  icon: LucideIcon;
  show: boolean;
};

export function buildShortletsNavItems(baseHref: string, access: ShortletsNavAccess): Array<ShortletsNavItem & { href: string }> {
  const items: ShortletsNavItem[] = [
    { id: "front-desk", label: "Front desk", hrefSuffix: "/front-desk", icon: ConciergeBell, show: access.canManage },
    { id: "rooms", label: "Room board", hrefSuffix: "/rooms", icon: BedDouble, show: access.canManage || access.canHousekeeping },
    { id: "reservations", label: "Reservations", hrefSuffix: "/reservations", icon: CalendarDays, show: access.canManage },
    { id: "locations", label: "Locations", hrefSuffix: "/locations", icon: MapPin, show: access.canManage },
    { id: "apartments", label: "Apartments", hrefSuffix: "/apartments", icon: Building2, show: access.canManage },
    { id: "guests", label: "Guests", hrefSuffix: "/guests", icon: Users, show: access.canManage },
    {
      id: "inspections",
      label: "Inspections",
      hrefSuffix: "/inspections",
      icon: ClipboardCheck,
      show: access.canManage || access.canHousekeeping,
    },
    { id: "channels", label: "Channels", hrefSuffix: "/channels", icon: Radio, show: access.canManage },
    { id: "folio", label: "Guest bill", hrefSuffix: "/folio", icon: Receipt, show: access.canPostFolio },
    { id: "reports", label: "Reports", hrefSuffix: "/reports", icon: BarChart2, show: access.canReports },
    { id: "settings", label: "Settings", hrefSuffix: "/settings", icon: Settings, show: access.canSettings },
  ];

  return items
    .filter((item) => item.show)
    .map((item) => ({ ...item, href: `${baseHref}${item.hrefSuffix}` }));
}
