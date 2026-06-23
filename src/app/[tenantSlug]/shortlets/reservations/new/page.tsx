import prisma from "@/lib/db";
import { loadShortletsContext } from "@/lib/shortlets-loaders";
import { NewBookingWorkspace } from "./new-booking-workspace";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewReservationPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams?: Promise<{ guestId?: string; checkIn?: string; checkOut?: string }>;
}) {
  const { tenantSlug } = await params;
  const sp = searchParams ? await searchParams : {};
  const ctx = await loadShortletsContext(tenantSlug);
  if (!ctx.access.canManage) notFound();

  const [guests, locations] = await Promise.all([
    prisma.shortletGuest.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: { fullName: "asc" },
      take: 1000,
      select: { id: true, fullName: true, email: true, phone: true },
    }),
    prisma.shortletProperty.findMany({
      where: { tenantId: ctx.tenant.id, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <NewBookingWorkspace
      tenantSlug={ctx.tenant.slug}
      defaultCheckInTime={ctx.pmsSettings.checkInTime}
      defaultCheckOutTime={ctx.pmsSettings.checkOutTime}
      defaultCurrency={ctx.tenant.defaultCurrency}
      prefillGuestId={sp.guestId}
      prefillCheckIn={sp.checkIn}
      prefillCheckOut={sp.checkOut}
      guests={guests.map((g) => ({
        id: g.id,
        label: g.fullName,
        email: g.email,
        phone: g.phone,
      }))}
      locationOptions={locations.map((l) => ({ id: l.id, label: l.name }))}
    />
  );
}
