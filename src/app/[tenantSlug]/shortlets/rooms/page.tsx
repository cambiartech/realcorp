import prisma from "@/lib/db";
import { MembershipStatus } from "@/generated/prisma";
import { formatEnumLabel } from "@/lib/ui-format";
import { loadShortletsContext } from "@/lib/shortlets-loaders";
import { countByHousekeepingStatus } from "@/lib/shortlets-analytics";
import { isCheckoutDueSoon, isCheckoutOverdue } from "@/lib/shortlets-settings";
import { RoomsWorkspace } from "./rooms-workspace";

export const dynamic = "force-dynamic";

export default async function RoomsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const ctx = await loadShortletsContext(tenantSlug);
  const now = new Date();

  const [units, teamMembers] = await Promise.all([
    prisma.shortletUnit.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: { name: "asc" },
      include: {
        property: { select: { name: true } },
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
  ]);

  const summary = countByHousekeepingStatus(units);

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
      canHousekeeping={ctx.access.canHousekeeping}
      rooms={rooms}
      summary={summary}
      teamOptions={teamMembers.map((m) => ({
        id: m.user.id,
        label: m.user.name || m.user.email || "Staff",
      }))}
    />
  );
}
