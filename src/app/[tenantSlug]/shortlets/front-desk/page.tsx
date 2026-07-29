import prisma from "@/lib/db";
import { MembershipStatus } from "@/generated/prisma";
import { formatEnumLabel } from "@/lib/ui-format";
import { ACTIVE_FOLIO_STATUS_VALUES } from "@/lib/shortlets-reservation-status";
import { loadShortletsContext } from "@/lib/shortlets-loaders";
import { isCheckoutDueSoon, isCheckoutOverdue } from "@/lib/shortlets-settings";
import { loadInHouseGuests } from "@/lib/shortlets-night-audit";
import { formatReservationFolioBundle, FOLIO_RESERVATION_INCLUDE } from "@/lib/shortlets-folio";
import { FrontDeskWorkspace } from "./front-desk-workspace";

export const dynamic = "force-dynamic";

export default async function FrontDeskPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const ctx = await loadShortletsContext(tenantSlug);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [reservations, units, inHouseReservations, departureDetails] = await Promise.all([
    prisma.shortletReservation.findMany({
      where: {
        tenantId: ctx.tenant.id,
        status: { in: [...ACTIVE_FOLIO_STATUS_VALUES] },
        OR: [{ checkIn: { gte: todayStart, lt: todayEnd } }, { checkOut: { gte: todayStart, lt: todayEnd } }],
      },
      include: { unit: { select: { name: true } }, property: { select: { name: true } } },
      orderBy: { checkIn: "asc" },
    }),
    prisma.shortletUnit.findMany({
      where: { tenantId: ctx.tenant.id, housekeepingStatus: "VACANT_CLEAN" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.shortletReservation.findMany({
      where: { tenantId: ctx.tenant.id, status: "CHECKED_IN" },
      include: { unit: { select: { name: true } }, property: { select: { name: true } } },
      orderBy: { checkIn: "asc" },
    }),
    prisma.shortletReservation.findMany({
      where: {
        tenantId: ctx.tenant.id,
        status: "CHECKED_IN",
        checkOut: { gte: todayStart, lt: todayEnd },
      },
      include: FOLIO_RESERVATION_INCLUDE,
    }),
  ]);

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(d);

  const folioById = new Map(departureDetails.map((r) => [r.id, formatReservationFolioBundle(r)]));

  const arrivals = reservations
    .filter((r) => r.checkIn >= todayStart && r.checkIn < todayEnd)
    .map((r) => ({
      id: r.id,
      guestName: r.guestName,
      unitName: r.unit?.name || r.property?.name || "Apartment TBD",
      checkInLabel: fmt(r.checkIn),
      status: formatEnumLabel(r.status),
      statusValue: r.status,
      hasApartment: Boolean(r.unitId),
    }));

  const departures = reservations
    .filter((r) => r.status === "CHECKED_IN" && r.checkOut >= todayStart && r.checkOut < todayEnd)
    .map((r) => {
      const overdue = isCheckoutOverdue(r.checkOut, ctx.pmsSettings.checkOutTime, now);
      const dueSoon =
        !overdue &&
        isCheckoutDueSoon(r.checkOut, ctx.pmsSettings.checkOutTime, ctx.pmsSettings.checkoutAlertHours, now);
      return {
        id: r.id,
        guestName: r.guestName,
        unitName: r.unit?.name || r.property?.name || "Apartment TBD",
        checkOutLabel: fmt(r.checkOut),
        balanceLabel: `${r.currency} ${Number(r.balanceDue).toLocaleString()}`,
        alertLevel: overdue ? ("overdue" as const) : dueSoon ? ("due-soon" as const) : ("normal" as const),
        folio: folioById.get(r.id) || null,
      };
    });

  return (
    <FrontDeskWorkspace
      tenantSlug={ctx.tenant.slug}
      canManage={ctx.access.canManage}
      defaultCheckInTime={ctx.pmsSettings.checkInTime}
      defaultCheckOutTime={ctx.pmsSettings.checkOutTime}
      arrivals={arrivals}
      departures={departures}
      inHouseGuests={loadInHouseGuests(
        inHouseReservations.map((r) => ({ ...r, currency: r.currency })),
        ctx.tenant.defaultCurrency,
      )}
      walkInUnitOptions={units.map((u) => ({ id: u.id, label: u.name }))}
      currencies={ctx.currencies}
      defaultCurrency={ctx.tenant.defaultCurrency}
    />
  );
}
