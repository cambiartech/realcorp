import prisma from "@/lib/db";
import { formatEnumLabel } from "@/lib/ui-format";
import { loadShortletsContext } from "@/lib/shortlets-loaders";
import { formatReservationFolioBundle, FOLIO_RESERVATION_INCLUDE } from "@/lib/shortlets-folio";
import { isActiveFolioStatus, formatReservationStatusLabel } from "@/lib/shortlets-reservation-status";
import { ReservationsWorkspace } from "./reservations-workspace";

export const dynamic = "force-dynamic";

export default async function ReservationsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const ctx = await loadShortletsContext(tenantSlug);
  const now = new Date();
  const calendarMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [reservations, units] = await Promise.all([
    prisma.shortletReservation.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: { checkIn: "desc" },
      include: {
        ...FOLIO_RESERVATION_INCLUDE,
        unit: { select: { name: true } },
        property: { select: { name: true } },
      },
      take: 300,
    }),
    prisma.shortletUnit.findMany({
      where: { tenantId: ctx.tenant.id },
      select: { id: true, name: true, housekeepingStatus: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const fmtStay = (checkIn: Date, checkOut: Date) =>
    `${new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(checkIn)} – ${new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(checkOut)}`;

  const folioByReservationId = Object.fromEntries(
    reservations
      .filter((r) => isActiveFolioStatus(r.status))
      .map((r) => [r.id, formatReservationFolioBundle(r)]),
  );

  return (
    <ReservationsWorkspace
      tenantSlug={ctx.tenant.slug}
      canManage={ctx.access.canManage}
      calendarMonth={calendarMonth}
      folioByReservationId={folioByReservationId}
      reservations={reservations.map((r) => ({
        id: r.id,
        bookingNumber: r.bookingNumber,
        unitName: r.unit?.name || r.property?.name || "Apartment TBD",
        hasApartment: Boolean(r.unitId),
        guestName: r.guestName,
        source: formatEnumLabel(r.source),
        stayLabel: fmtStay(r.checkIn, r.checkOut),
        nights: r.nights,
        totalAmountLabel: `${r.currency} ${Number(r.totalAmount).toLocaleString()}`,
        balanceLabel: `${r.currency} ${Number(r.balanceDue).toLocaleString()}`,
        cautionFeeLabel: r.cautionFee != null ? `${r.currency} ${Number(r.cautionFee).toLocaleString()}` : null,
        status: formatReservationStatusLabel(r.status),
        statusValue: r.status,
        checkIn: r.checkIn.toISOString().slice(0, 10),
        checkOut: r.checkOut.toISOString().slice(0, 10),
      }))}
      unitOptions={units.map((u) => ({
        id: u.id,
        label: `${u.name} (${formatEnumLabel(u.housekeepingStatus).toLowerCase()})`,
      }))}
    />
  );
}
