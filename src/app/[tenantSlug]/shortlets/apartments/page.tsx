import prisma from "@/lib/db";
import { formatEnumLabel } from "@/lib/ui-format";
import { loadShortletsContext } from "@/lib/shortlets-loaders";
import { ApartmentsWorkspace } from "./apartments-workspace";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ApartmentsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const ctx = await loadShortletsContext(tenantSlug);
  if (!ctx.access.canManage) notFound();

  const [apartments, locations, projectUnits] = await Promise.all([
    prisma.shortletUnit.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: { name: "asc" },
      include: {
        property: { select: { id: true, name: true } },
        projectUnit: { select: { label: true, project: { select: { name: true } } } },
      },
    }),
    prisma.shortletProperty.findMany({
      where: { tenantId: ctx.tenant.id, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.unit.findMany({
      where: { tenantId: ctx.tenant.id, shortletUnit: null },
      select: { id: true, label: true, unitType: true, project: { select: { name: true } } },
      orderBy: [{ project: { name: "asc" } }, { label: "asc" }],
      take: 500,
    }),
  ]);

  return (
    <ApartmentsWorkspace
      tenantSlug={ctx.tenant.slug}
      defaultCurrency={ctx.tenant.defaultCurrency}
      currencies={ctx.currencies}
      locationOptions={locations.map((l) => ({ id: l.id, label: l.name }))}
      projectUnitOptions={projectUnits.map((u) => ({
        id: u.id,
        label: `${u.project.name} · ${u.label}${u.unitType ? ` (${u.unitType})` : ""}`,
      }))}
      apartments={apartments.map((u) => ({
        id: u.id,
        name: u.name,
        locationName: u.property?.name || "",
        propertyId: u.propertyId || "",
        floor: u.floor || "",
        roomLayout: u.roomLayout || "",
        nightlyRate: Number(u.nightlyRate),
        nightlyRateLabel: `${u.currency} ${Number(u.nightlyRate).toLocaleString()}`,
        cleaningFee: u.cleaningFee != null ? Number(u.cleaningFee) : null,
        cautionFee: u.cautionFee != null ? Number(u.cautionFee) : null,
        currency: u.currency,
        sizeSqFt: u.sizeSqFt,
        maxOccupancy: u.maxOccupancy,
        description: u.description || "",
        amenities: Array.isArray(u.amenities) ? (u.amenities as string[]) : [],
        listingStatus: formatEnumLabel(u.listingStatus),
        listingStatusValue: u.listingStatus,
        housekeepingStatus: formatEnumLabel(u.housekeepingStatus),
        isActive: u.isActive,
        linkedProjectUnit: u.projectUnit ? `${u.projectUnit.project.name} · ${u.projectUnit.label}` : null,
      }))}
    />
  );
}
