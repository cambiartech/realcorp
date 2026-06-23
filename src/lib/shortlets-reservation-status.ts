import { ShortletReservationStatus } from "@/generated/prisma";

/** Statuses that block the room calendar (unit unavailable for overlapping dates). */
export const BLOCKING_SHORTLET_STATUSES: ShortletReservationStatus[] = [
  ShortletReservationStatus.PENDING,
  ShortletReservationStatus.CONFIRMED,
  ShortletReservationStatus.RESERVED,
  ShortletReservationStatus.CHECKED_IN,
];

/** Statuses where folio charges and payments are allowed. */
export const ACTIVE_FOLIO_STATUSES: ShortletReservationStatus[] = [
  ShortletReservationStatus.PENDING,
  ShortletReservationStatus.CONFIRMED,
  ShortletReservationStatus.RESERVED,
  ShortletReservationStatus.CHECKED_IN,
];

export function canCheckInFromStatus(status: ShortletReservationStatus): boolean {
  return (
    status === ShortletReservationStatus.PENDING ||
    status === ShortletReservationStatus.CONFIRMED ||
    status === ShortletReservationStatus.RESERVED
  );
}

export function isPreArrivalStatus(status: ShortletReservationStatus | string): boolean {
  return status === "PENDING" || status === "CONFIRMED" || status === "RESERVED";
}

export const ACTIVE_FOLIO_STATUS_VALUES = ["PENDING", "CONFIRMED", "RESERVED", "CHECKED_IN"] as const;

export function isActiveFolioStatus(status: string): boolean {
  return (ACTIVE_FOLIO_STATUS_VALUES as readonly string[]).includes(status);
}

export function formatReservationStatusLabel(status: ShortletReservationStatus | string): string {
  if (status === "RESERVED") return "Confirmed";
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}
