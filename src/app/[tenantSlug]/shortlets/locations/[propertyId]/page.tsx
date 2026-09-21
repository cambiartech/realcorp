import prisma from "@/lib/db";
import { MembershipStatus } from "@/generated/prisma";
import { formatEnumLabel } from "@/lib/ui-format";
import { sortByUnitLabel } from "@/lib/unit-label-sort";
import { loadShortletsContext } from "@/lib/shortlets-loaders";
import { countByHousekeepingStatus } from "@/lib/shortlets-analytics";
import { isCheckoutDueSoon, isCheckoutOverdue } from "@/lib/shortlets-settings";
import { LocationBoardWorkspace } from "./location-board-workspace";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LocationBoardPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; propertyId: string }>;
}) {
  const { tenantSlug, propertyId } = await params;
  const ctx = await loadShortletsContext(tenantSlug);
  if (!ctx.access.canManage && !ctx.access.canHousekeeping) notFound();

  const property = await prisma.shortletProperty.findFirst({
    where: { id: propertyId, tenantId: ctx.tenant.id },
  });
  if (!property) notFound();

  const now = new Date();
  const [units, teamMembers] = await Promise.all([
    prisma.shortletUnit.findMany({
      where: { tenantId: ctx.tenant.id, propertyId: property.id },
      orderBy: { name: "asc" },
      include: {
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

  const boardUnits = sortByUnitLabel(
    units.map((u) => {
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
        floor: u.floor || "",
        status: formatEnumLabel(u.housekeepingStatus),
        statusValue: u.housekeepingStatus,
        guestLabel: res ? res.guestName : null,
        checkoutLabel: res
          ? new Intl.DateTimeFormat("en-NG", { dateStyle: "short", timeStyle: "short" }).format(res.checkOut)
          : null,
        alertLevel,
        assignedToUserId: u.assignedToUserId,
        nightlyRateLabel: `${u.currency} ${Number(u.nightlyRate).toLocaleString("en-NG")}`,
      };
    }),
    (u) => u.name,
  );

  return (
    <LocationBoardWorkspace
      tenantSlug={ctx.tenant.slug}
      propertyId={property.id}
      locationName={property.name}
      locationCode={property.locationCode || ""}
      city={property.city || ""}
      canHousekeeping={ctx.access.canHousekeeping || ctx.access.canManage}
      units={boardUnits}
      summary={summary}
      teamOptions={teamMembers.map((m) => ({
        id: m.user.id,
        label: m.user.name || m.user.email || "Staff",
      }))}
    />
  );
}
