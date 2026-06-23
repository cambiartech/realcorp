import prisma from "@/lib/db";
import { loadShortletsContext } from "@/lib/shortlets-loaders";
import { LocationsWorkspace } from "./locations-workspace";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LocationsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const ctx = await loadShortletsContext(tenantSlug);
  if (!ctx.access.canManage) notFound();

  const locations = await prisma.shortletProperty.findMany({
    where: { tenantId: ctx.tenant.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { units: true } } },
  });

  return (
    <LocationsWorkspace
      tenantSlug={ctx.tenant.slug}
      locations={locations.map((l) => ({
        id: l.id,
        name: l.name,
        locationCode: l.locationCode || "",
        address: l.address || "",
        city: l.city || "",
        state: l.state || "",
        country: l.country || "Nigeria",
        phone: l.phone || "",
        email: l.email || "",
        isActive: l.isActive,
        apartmentCount: l._count.units,
      }))}
    />
  );
}
