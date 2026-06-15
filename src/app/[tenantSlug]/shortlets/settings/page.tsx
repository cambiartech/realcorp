import prisma from "@/lib/db";
import { formatEnumLabel } from "@/lib/ui-format";
import { loadShortletsContext } from "@/lib/shortlets-loaders";
import { SettingsWorkspace } from "./settings-workspace";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type SettingsTab = "operations" | "inventory" | "catalog";

function parseSettingsTab(value?: string): SettingsTab {
  if (value === "inventory" || value === "catalog") return value;
  return "operations";
}

export default async function ShortletSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { tenantSlug } = await params;
  const sp = searchParams ? await searchParams : {};
  const tab = parseSettingsTab(sp.tab);
  const ctx = await loadShortletsContext(tenantSlug);
  if (!ctx.access.canSettings) notFound();

  const [serviceItems, projectUnits, properties, units] = await Promise.all([
    prisma.shortletServiceItem.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: [{ department: "asc" }, { name: "asc" }],
    }),
    prisma.unit.findMany({
      where: { tenantId: ctx.tenant.id, shortletUnit: null },
      select: { id: true, label: true, unitType: true, status: true, project: { select: { name: true } } },
      orderBy: [{ project: { name: "asc" } }, { label: "asc" }],
      take: 500,
    }),
    prisma.shortletProperty.findMany({
      where: { tenantId: ctx.tenant.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { units: true } } },
    }),
    prisma.shortletUnit.findMany({
      where: { tenantId: ctx.tenant.id },
      select: { id: true, name: true, location: true, nightlyRate: true, currency: true, propertyId: true, property: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <SettingsWorkspace
      tab={tab}
      tenantSlug={ctx.tenant.slug}
      defaultCurrency={ctx.tenant.defaultCurrency}
      currencies={ctx.currencies}
      pmsSettings={ctx.pmsSettings}
      moduleFinance={ctx.tenant.settings?.moduleFinance ?? false}
      properties={properties.map((p) => ({
        id: p.id,
        name: p.name,
        address: p.address || "",
        isActive: p.isActive,
        unitCount: p._count.units,
      }))}
      units={units.map((u) => ({
        id: u.id,
        name: u.name,
        location: u.location || "",
        nightlyRateLabel: `${u.currency} ${Number(u.nightlyRate).toLocaleString()}`,
        propertyId: u.propertyId || "",
        propertyLabel: u.property?.name || "",
      }))}
      serviceItems={serviceItems.map((s) => ({
        id: s.id,
        department: formatEnumLabel(s.department),
        departmentValue: s.department as "FNB" | "LAUNDRY" | "LOUNGE" | "GYM" | "OTHER",
        name: s.name,
        price: Number(s.price),
        priceLabel: `${s.currency} ${Number(s.price).toLocaleString()}`,
        currency: s.currency,
        active: s.active,
      }))}
      projectUnitOptions={projectUnits.map((u) => ({
        id: u.id,
        label: `${u.project.name} · ${u.label}${u.unitType ? ` (${u.unitType})` : ""}`,
      }))}
    />
  );
}
