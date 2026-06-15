import type { ShortletHousekeepingStatus, ShortletReservationStatus } from "@/generated/prisma";

type UnitRow = { housekeepingStatus: ShortletHousekeepingStatus };
type ReservationRow = {
  status: ShortletReservationStatus;
  nights: number;
  totalAmount: number | { toString(): string };
  checkIn: Date;
  checkOut: Date;
};

export function computeOccupancyPercent(units: UnitRow[]): number {
  if (units.length === 0) return 0;
  const occupied = units.filter((u) => u.housekeepingStatus === "OCCUPIED").length;
  return Math.round((occupied / units.length) * 100);
}

export function computeAdr(reservations: ReservationRow[], currency = "NGN"): { adr: number; label: string } {
  const eligible = reservations.filter((r) => r.status === "CHECKED_IN" || r.status === "CHECKED_OUT");
  if (eligible.length === 0) return { adr: 0, label: `${currency} 0` };
  const roomRevenue = eligible.reduce((sum, r) => sum + Number(r.totalAmount), 0);
  const roomNights = eligible.reduce((sum, r) => sum + r.nights, 0);
  const adr = roomNights > 0 ? roomRevenue / roomNights : 0;
  return { adr, label: `${currency} ${Math.round(adr).toLocaleString()}` };
}

export function countByHousekeepingStatus(units: UnitRow[]) {
  return {
    vacantClean: units.filter((u) => u.housekeepingStatus === "VACANT_CLEAN").length,
    vacantDirty: units.filter((u) => u.housekeepingStatus === "VACANT_DIRTY").length,
    occupied: units.filter((u) => u.housekeepingStatus === "OCCUPIED").length,
    outOfOrder: units.filter((u) => u.housekeepingStatus === "OUT_OF_ORDER").length,
  };
}
