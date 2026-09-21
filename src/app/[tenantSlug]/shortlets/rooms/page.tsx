import prisma from "@/lib/db";
import { MembershipStatus } from "@/generated/prisma";
import { formatEnumLabel } from "@/lib/ui-format";
import { sortByUnitLabel } from "@/lib/unit-label-sort";
import { loadShortletsContext } from "@/lib/shortlets-loaders";
import { countByHousekeepingStatus } from "@/lib/shortlets-analytics";
import { isCheckoutDueSoon, isCheckoutOverdue } from "@/lib/shortlets-settings";
import { RoomsWorkspace } from "./rooms-workspace";

export const dynamic = "force-dynamic";

export default async function RoomsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ location?: string }>;
}) {
  const { tenantSlug } = await params;
  const sp = await searchParams;
  const ctx = await loadShortletsContext(tenantSlug);
  const now = new Date();

  const [units, teamMembers, locations] = await Promise.all([
    prisma.shortletUnit.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: { name: "asc" },
      include: {
        property: { select: { id: true, name: true } },
        activeReservation: {
          select: { guestName: true, checkOut: true, status: true },
        },
      },
    }),
    prisma.membership.findMany({
      where: { tenantId: ctx.tenant.id, status: MembershipStatus.ACTIVE },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.shortletProperty.findMany({
      where: { tenantId: ctx.tenant.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  const summary = countByHousekeepingStatus(units);
  const initialLocationId =
    sp.location && locations.some((l) => l.id === sp.location) ? sp.location : "";

  const rooms = units.map((u) => {
    const res = u.activeReservation;
    let alertLevel: "normal" | "due-soon" | "overdue" | null = null;
    if (res?.status === "CHECKED_IN") {
      const overdue = isCheckoutOverdue(res.checkOut, ctx.pmsSettings.checkOutTime, now);
      const dueSoon =
        !overdue &&
        isCheckoutDueSoon(
          res.checkOut,
          ctx.pmsSettings.checkOutTime,
          ctx.pmsSettings.checkoutAlertHours,
          now,
        );
      alertLevel = overdue ? "overdue" : dueSoon ? "due-soon" : "normal";
    }
    return {
      id: u.id,
      name: u.name,
      propertyId: u.propertyId || u.property?.id || null,
      propertyName: u.property?.name || null,
      location: u.location || "—",
      status: formatEnumLabel(u.housekeepingStatus),
      statusValue: u.housekeepingStatus,
      guestLabel: res ? `${res.guestName}` : null,
      checkoutLabel: res
        ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(res.checkOut)
        : null,
      alertLevel,
      assignedToUserId: u.assignedToUserId,
      assignedToLabel: u.assignedToLabel,
    };
  });

  return (
    <RoomsWorkspace
      tenantSlug={ctx.tenant.slug}
      canHousekeeping={ctx.access.canHousekeeping || ctx.access.canManage}
      rooms={sortByUnitLabel(rooms, (room) => room.name)}
      summary={summary}
      teamOptions={teamMembers.map((m) => ({
        id: m.user.id,
        label: m.user.name || m.user.email || "Staff",
      }))}
      locationOptions={locations.map((l) => ({ id: l.id, label: l.name }))}
      initialLocationId={initialLocationId}
    />
  );
}
