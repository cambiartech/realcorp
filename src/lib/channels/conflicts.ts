import { BLOCKING_SHORTLET_STATUSES } from "@/lib/shortlets-reservation-status";
import prisma from "@/lib/db";
import { calendarDate, rangesOverlap, stayToBlock, utcDate } from "@/lib/channels/calendar";

export async function unitStayConflict(input: {
  tenantId: string;
  unitId: string;
  checkIn: Date;
  checkOut: Date;
  ignoreReservationId?: string;
  timeZone?: string;
}): Promise<"reservation" | "channel" | null> {
  const reservation = await prisma.shortletReservation.findFirst({
    where: {
      tenantId: input.tenantId,
      unitId: input.unitId,
      ...(input.ignoreReservationId ? { id: { not: input.ignoreReservationId } } : {}),
      status: { in: BLOCKING_SHORTLET_STATUSES },
      checkIn: { lt: input.checkOut },
      checkOut: { gt: input.checkIn },
    },
    select: { id: true },
  });
  if (reservation) return "reservation";

  const stay = stayToBlock(input.checkIn, input.checkOut, input.timeZone);
  const external = await prisma.channelExternalBlock.findMany({
    where: {
      tenantId: input.tenantId,
      unitId: input.unitId,
      startDate: { lt: utcDate(stay.end) },
      endDate: { gt: utcDate(stay.start) },
    },
    select: { startDate: true, endDate: true },
  });
  const hit = external.some((block) =>
    rangesOverlap(
      stay.start,
      stay.end,
      block.startDate.toISOString().slice(0, 10),
      block.endDate.toISOString().slice(0, 10),
    ),
  );
  return hit ? "channel" : null;
}

export async function unitIdsBlockedByChannels(input: {
  tenantId: string;
  unitIds: string[];
  checkIn: Date;
  checkOut: Date;
  timeZone?: string;
}): Promise<Set<string>> {
  if (input.unitIds.length === 0) return new Set();
  const stay = stayToBlock(input.checkIn, input.checkOut, input.timeZone);
  const rows = await prisma.channelExternalBlock.findMany({
    where: {
      tenantId: input.tenantId,
      unitId: { in: input.unitIds },
      startDate: { lt: utcDate(stay.end) },
      endDate: { gt: utcDate(stay.start) },
    },
    select: { unitId: true },
  });
  return new Set(rows.map((row) => row.unitId));
}

export function conflictMessage(kind: "reservation" | "channel", unitName?: string): string {
  const where = unitName ? ` on ${unitName}` : " on this apartment";
  if (kind === "channel") {
    return `Those dates are already blocked${where} by Airbnb, Booking.com, or another calendar.`;
  }
  return `Selected dates overlap an existing reservation${where}.`;
}

export function lagosToday(now = new Date()): string {
  return calendarDate(now, "Africa/Lagos");
}
