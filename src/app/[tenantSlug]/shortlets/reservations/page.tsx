import prisma from "@/lib/db";
import { formatEnumLabel } from "@/lib/ui-format";
import { loadShortletsContext } from "@/lib/shortlets-loaders";
import { formatReservationFolioBundle, FOLIO_RESERVATION_INCLUDE } from "@/lib/shortlets-folio";
import { guestClientProfileHref } from "@/lib/shortlets-guest-crm";
import { ReservationsWorkspace } from "./reservations-workspace";

export const dynamic = "force-dynamic";

export default async function ReservationsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const ctx = await loadShortletsContext(tenantSlug);
  const now = new Date();
  const calendarMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [reservations, units, projectUnits] = await Promise.all([
    prisma.shortletReservation.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: { checkIn: "desc" },
      include: FOLIO_RESERVATION_INCLUDE,
      take: 300,
    }),
    prisma.shortletUnit.findMany({
      where: { tenantId: ctx.tenant.id },
      select: { id: true, name: true, housekeepingStatus: true },
      orderBy: { name: "asc" },
    }),
    prisma.unit.findMany({
      where: { tenantId: ctx.tenant.id, shortletUnit: null },
      select: { id: true, label: true, unitType: true, status: true, project: { select: { name: true } } },
      orderBy: [{ project: { name: "asc" } }, { label: "asc" }],
      take: 500,
    }),
  ]);

  const fmtStay = (checkIn: Date, checkOut: Date) =>
    `${new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(checkIn)} – ${new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(checkOut)}`;

  const folioByReservationId = Object.fromEntries(
    reservations
      .filter((r) => r.status === "RESERVED" || r.status === "CHECKED_IN")
      .map((r) => [r.id, formatReservationFolioBundle(r)]),
  );

  return (
    <ReservationsWorkspace
      tenantSlug={ctx.tenant.slug}
      canManage={ctx.access.canManage}
      defaultCheckInTime={ctx.pmsSettings.checkInTime}
      defaultCheckOutTime={ctx.pmsSettings.checkOutTime}
      defaultCurrency={ctx.tenant.defaultCurrency}
      currencies={ctx.currencies}
      calendarMonth={calendarMonth}
      folioByReservationId={folioByReservationId}
      reservations={reservations.map((r) => ({
        id: r.id,
        unitName: r.unit.name,
        guestName: r.guestName,
        guestClientId: r.guestClientId,
        guestProfileHref: guestClientProfileHref(ctx.tenant.slug, r.guestClientId, ctx.moduleClients),
        source: formatEnumLabel(r.source),
        stayLabel: fmtStay(r.checkIn, r.checkOut),
        nights: r.nights,
        totalAmountLabel: `${r.currency} ${Number(r.totalAmount).toLocaleString()}`,
        balanceLabel: `${r.currency} ${Number(r.balanceDue).toLocaleString()}`,
        status: formatEnumLabel(r.status),
        statusValue: r.status,
        checkIn: r.checkIn.toISOString().slice(0, 10),
        checkOut: r.checkOut.toISOString().slice(0, 10),
      }))}
      unitOptions={units.map((u) => ({
        id: u.id,
        label: `${u.name} (${formatEnumLabel(u.housekeepingStatus).toLowerCase()})`,
      }))}
      projectUnitOptions={projectUnits.map((u) => ({
        id: u.id,
        label: `${u.project.name} · ${u.label}`,
      }))}
    />
  );
}
