import prisma from "@/lib/db";
import { formatEnumLabel } from "@/lib/ui-format";
import { ACTIVE_FOLIO_STATUS_VALUES } from "@/lib/shortlets-reservation-status";
import { loadShortletsContext } from "@/lib/shortlets-loaders";
import { FolioWorkspace } from "./folio-workspace";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function FolioPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const ctx = await loadShortletsContext(tenantSlug);
  if (!ctx.access.canPostFolio) notFound();

  const [activeStays, serviceItems, folioLines] = await Promise.all([
    prisma.shortletReservation.findMany({
      where: { tenantId: ctx.tenant.id, status: { in: [...ACTIVE_FOLIO_STATUS_VALUES] } },
      include: { unit: { select: { name: true } }, property: { select: { name: true } } },
      orderBy: { checkIn: "asc" },
    }),
    prisma.shortletServiceItem.findMany({
      where: { tenantId: ctx.tenant.id, active: true },
      orderBy: [{ department: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.shortletFolioLine.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: { postedAt: "desc" },
      include: {
        reservation: {
          select: { guestName: true, unit: { select: { name: true } }, property: { select: { name: true } } },
        },
      },
      take: 100,
    }),
  ]);

  return (
    <FolioWorkspace
      tenantSlug={ctx.tenant.slug}
      activeStays={activeStays.map((r) => ({
        id: r.id,
        label: `${r.guestName} — ${r.unit?.name || r.property?.name || "Apartment TBD"}`,
      }))}
      serviceItems={serviceItems.map((s) => ({
        id: s.id,
        department: s.department,
        name: s.name,
        price: Number(s.price),
        priceLabel: `${s.currency} ${Number(s.price).toLocaleString()}`,
      }))}
      recentLines={folioLines.map((l) => ({
        id: l.id,
        guestName: l.reservation.guestName,
        unitName: l.reservation.unit?.name || l.reservation.property?.name || "Apartment TBD",
        department: formatEnumLabel(l.department),
        description: l.description,
        amountLabel: `${l.currency} ${Number(l.amount).toLocaleString()}`,
        postedAtLabel: new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(l.postedAt),
      }))}
    />
  );
}
