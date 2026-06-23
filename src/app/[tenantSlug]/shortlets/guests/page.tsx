import prisma from "@/lib/db";
import { formatEnumLabel } from "@/lib/ui-format";
import { loadShortletsContext } from "@/lib/shortlets-loaders";
import { GuestsWorkspace } from "./guests-workspace";

export const dynamic = "force-dynamic";

export default async function GuestsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const ctx = await loadShortletsContext(tenantSlug);

  const guests = await prisma.shortletGuest.findMany({
    where: { tenantId: ctx.tenant.id },
    orderBy: { updatedAt: "desc" },
    take: 500,
    include: {
      _count: { select: { reservations: true } },
      reservations: {
        orderBy: { checkOut: "desc" },
        take: 1,
        select: { checkOut: true },
      },
    },
  });

  const fmt = (d: Date) => new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(d);

  return (
    <GuestsWorkspace
      tenantSlug={ctx.tenant.slug}
      canManage={ctx.access.canManage}
      guests={guests.map((g) => ({
        id: g.id,
        fullName: g.fullName,
        email: g.email,
        phone: g.phone,
        guestType: formatEnumLabel(g.guestType),
        reservationCount: g._count.reservations,
        lastStayLabel: g.reservations[0] ? fmt(g.reservations[0].checkOut) : null,
        createdAtLabel: fmt(g.createdAt),
      }))}
    />
  );
}
