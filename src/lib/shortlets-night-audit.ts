import { formatEnumLabel } from "@/lib/ui-format";
import { isActiveFolioStatus, isPreArrivalStatus } from "@/lib/shortlets-reservation-status";
import { computeAdr, computeOccupancyPercent, countByHousekeepingStatus } from "@/lib/shortlets-analytics";

export type NightAuditInHouseGuest = {
  guestName: string;
  unitName: string;
  checkInLabel: string;
  checkOutLabel: string;
  balanceLabel: string;
  balanceDue: number;
};

export type NightAuditSnapshot = {
  businessDateLabel: string;
  currency: string;
  summary: {
    totalRooms: number;
    occupancyPercent: number;
    adrLabel: string;
    adr: number;
    inHouseCount: number;
    arrivalsTomorrow: number;
    departuresTomorrow: number;
  };
  housekeeping: {
    vacantClean: number;
    vacantDirty: number;
    occupied: number;
    outOfOrder: number;
  };
  revenue: {
    paymentsCollectedLabel: string;
    paymentsCollected: number;
    folioChargesLabel: string;
    folioCharges: number;
    outstandingLabel: string;
    outstanding: number;
    byDepartment: Array<{ department: string; amountLabel: string; amount: number }>;
  };
  inHouseGuests: NightAuditInHouseGuest[];
  closedByLabel?: string;
  closedAtLabel?: string;
};

type BuildNightAuditInput = {
  currency: string;
  businessDate: Date;
  closedAt?: Date;
  closedByLabel?: string;
  units: Array<{ name: string; housekeepingStatus: string }>;
  reservations: Array<{
    guestName: string;
    status: string;
    checkIn: Date;
    checkOut: Date;
    balanceDue: number | { toString(): string };
    nights: number;
    totalAmount: number | { toString(): string };
    unit: { name: string } | null;
    property?: { name: string } | null;
  }>;
  dayPayments: Array<{ amount: number | { toString(): string } }>;
  dayFolioLines: Array<{ department: string; amount: number | { toString(): string } }>;
};

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(d);

const fmtDay = (d: Date) => new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(d);

export function buildNightAuditSnapshot(input: BuildNightAuditInput): NightAuditSnapshot {
  const { currency, businessDate, units, reservations, dayPayments, dayFolioLines } = input;
  const hk = countByHousekeepingStatus(units.map((u) => ({ housekeepingStatus: u.housekeepingStatus as never })));
  const occupancy = computeOccupancyPercent(units.map((u) => ({ housekeepingStatus: u.housekeepingStatus as never })));
  const adr = computeAdr(
    reservations.map((r) => ({
      status: r.status as never,
      nights: r.nights,
      totalAmount: r.totalAmount,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
    })),
    currency,
  );

  const dayStart = new Date(businessDate.getFullYear(), businessDate.getMonth(), businessDate.getDate());
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const tomorrowEnd = new Date(dayEnd);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

  const inHouse = reservations.filter((r) => r.status === "CHECKED_IN");
  const outstanding = reservations
    .filter((r) => isActiveFolioStatus(r.status))
    .reduce((s, r) => s + Number(r.balanceDue), 0);

  const paymentsCollected = dayPayments.reduce((s, p) => s + Number(p.amount), 0);
  const folioCharges = dayFolioLines.reduce((s, f) => s + Number(f.amount), 0);

  const deptMap = new Map<string, number>();
  for (const line of dayFolioLines) {
    const key = formatEnumLabel(line.department);
    deptMap.set(key, (deptMap.get(key) || 0) + Number(line.amount));
  }

  const arrivalsTomorrow = reservations.filter(
    (r) => isPreArrivalStatus(r.status) && r.checkIn >= dayEnd && r.checkIn < tomorrowEnd,
  ).length;
  const departuresTomorrow = reservations.filter(
    (r) => r.status === "CHECKED_IN" && r.checkOut >= dayEnd && r.checkOut < tomorrowEnd,
  ).length;

  return {
    businessDateLabel: fmtDay(businessDate),
    currency,
    summary: {
      totalRooms: units.length,
      occupancyPercent: occupancy,
      adrLabel: adr.label,
      adr: adr.adr,
      inHouseCount: inHouse.length,
      arrivalsTomorrow,
      departuresTomorrow,
    },
    housekeeping: hk,
    revenue: {
      paymentsCollected,
      paymentsCollectedLabel: `${currency} ${paymentsCollected.toLocaleString()}`,
      folioCharges,
      folioChargesLabel: `${currency} ${folioCharges.toLocaleString()}`,
      outstanding,
      outstandingLabel: `${currency} ${outstanding.toLocaleString()}`,
      byDepartment: Array.from(deptMap.entries()).map(([department, amount]) => ({
        department,
        amount,
        amountLabel: `${currency} ${amount.toLocaleString()}`,
      })),
    },
    inHouseGuests: inHouse.map((r) => ({
      guestName: r.guestName,
      unitName: r.unit?.name || r.property?.name || "Apartment TBD",
      checkInLabel: fmtDate(r.checkIn),
      checkOutLabel: fmtDate(r.checkOut),
      balanceDue: Number(r.balanceDue),
      balanceLabel: `${currency} ${Number(r.balanceDue).toLocaleString()}`,
    })),
    closedByLabel: input.closedByLabel,
    closedAtLabel: input.closedAt ? fmtDate(input.closedAt) : undefined,
  };
}

export function parseNightAuditSnapshot(raw: unknown): NightAuditSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as NightAuditSnapshot;
  if (!o.businessDateLabel || !o.summary || !o.revenue) return null;
  return o;
}

export function loadInHouseGuests(
  reservations: Array<{
    guestName: string;
    status: string;
    checkIn: Date;
    checkOut: Date;
    balanceDue: number | { toString(): string };
    currency: string;
    unit: { name: string } | null;
    property?: { name: string } | null;
  }>,
  currency: string,
): NightAuditInHouseGuest[] {
  return reservations
    .filter((r) => r.status === "CHECKED_IN")
    .map((r) => ({
      guestName: r.guestName,
      unitName: r.unit?.name || r.property?.name || "Apartment TBD",
      checkInLabel: fmtDate(r.checkIn),
      checkOutLabel: fmtDate(r.checkOut),
      balanceDue: Number(r.balanceDue),
      balanceLabel: `${r.currency || currency} ${Number(r.balanceDue).toLocaleString()}`,
    }));
}
