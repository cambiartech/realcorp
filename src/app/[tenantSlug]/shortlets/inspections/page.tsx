import prisma from "@/lib/db";
import { formatEnumLabel } from "@/lib/ui-format";
import { loadShortletsContext } from "@/lib/shortlets-loaders";
import { ShortletInspectionStatus } from "@/generated/prisma";
import { InspectionsWorkspace } from "./inspections-workspace";

export const dynamic = "force-dynamic";

export default async function InspectionsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const ctx = await loadShortletsContext(tenantSlug);

  const inspections = await prisma.shortletCheckoutInspection.findMany({
    where: { tenantId: ctx.tenant.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      unit: { select: { name: true } },
      reservation: {
        select: { guestName: true, bookingNumber: true, checkOut: true, currency: true, cautionFee: true },
      },
    },
  });

  const fmt = (d: Date) =>
    new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(d);

  const mapRow = (i: (typeof inspections)[number]) => {
    const photos = Array.isArray(i.photoUrls) ? (i.photoUrls as string[]) : [];
    return {
      id: i.id,
      unitName: i.unit.name,
      guestName: i.reservation.guestName,
      bookingNumber: i.reservation.bookingNumber,
      checkoutLabel: fmt(i.reservation.checkOut),
      status: formatEnumLabel(i.status),
      statusValue: i.status,
      photoCount: photos.length,
      cautionFeePaths:
        i.cautionFeeAmount != null
          ? `${i.reservation.currency} ${Number(i.cautionFeeAmount).toLocaleString()}`
          : i.reservation.cautionFee != null
            ? `${i.reservation.currency} ${Number(i.reservation.cautionFee).toLocaleString()}`
            : null,
    };
  };

  const awaiting = inspections
    .filter((i) => i.status === ShortletInspectionStatus.AWAITING_INSPECTION)
    .map(mapRow);
  const completed = inspections
    .filter((i) => i.status !== ShortletInspectionStatus.AWAITING_INSPECTION)
    .slice(0, 20)
    .map(mapRow);

  return (
    <InspectionsWorkspace
      tenantSlug={ctx.tenant.slug}
      canManage={ctx.access.canManage}
      awaiting={awaiting}
      completed={completed}
    />
  );
}
