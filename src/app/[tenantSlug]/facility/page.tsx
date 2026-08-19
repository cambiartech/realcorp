import { FacilityWorkspace } from "@/app/[tenantSlug]/facility/facility-workspace";
import { canManageFacility, canRecordFacility, canViewFacilityModule } from "@/lib/facility-access";
import { ensureFacilityDefaults } from "@/lib/facility-server";
import { redirectToLogin } from "@/lib/login-redirect";
import { normalizeSettingsNavSlice } from "@/lib/tenant-nav-access";
import { loadTenantRequest } from "@/lib/tenant-request";
import prisma from "@/lib/db";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function n(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateLabel(value: Date | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

export default async function FacilityPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { session, tenant, membership } = await loadTenantRequest(tenantSlug);
  if (!session?.user?.id) await redirectToLogin(`/${tenantSlug}/facility`);
  if (!tenant) notFound();
  const access = {
    isPlatformAdmin: Boolean(session.user.isPlatformAdmin),
    membership,
    moduleFacility: Boolean(normalizeSettingsNavSlice(tenant.settings).moduleFacility),
  };
  if (!canViewFacilityModule(access)) redirect(`/${tenantSlug}`);

  try {
    await ensureFacilityDefaults(tenant.id);
  } catch (error) {
    console.error("[facility-defaults]", error);
  }

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [
    items,
    locations,
    balances,
    movements,
    assets,
    damages,
    projects,
    units,
  ] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: [{ itemClass: "asc" }, { name: "asc" }],
    }),
    prisma.inventoryLocation.findMany({
      where: { tenantId: tenant.id, isActive: true },
      include: { project: { select: { name: true } } },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),
    prisma.inventoryBalance.findMany({
      where: { tenantId: tenant.id },
      include: { item: { select: { name: true, unitOfMeasure: true, reorderPoint: true } }, location: { select: { name: true } } },
    }),
    prisma.inventoryMovement.findMany({
      where: { tenantId: tenant.id },
      include: {
        item: { select: { name: true, unitOfMeasure: true } },
        fromLocation: { select: { name: true } },
        toLocation: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.inventoryAsset.findMany({
      where: { tenantId: tenant.id },
      include: { item: { select: { name: true } }, project: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.inventoryDamage.findMany({
      where: { tenantId: tenant.id },
      include: {
        item: { select: { name: true } },
        asset: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.project.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.unit.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, label: true, projectId: true },
      orderBy: { label: "asc" },
      take: 400,
    }),
  ]);

  const qtyByItem = new Map<string, number>();
  for (const row of balances) {
    qtyByItem.set(row.itemId, (qtyByItem.get(row.itemId) ?? 0) + n(row.quantity));
  }

  return (
    <FacilityWorkspace
      tenantSlug={tenantSlug}
      canManage={canManageFacility(access)}
      canRecord={canRecordFacility(access)}
      items={items.map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku || "",
        itemClass: item.itemClass,
        unitOfMeasure: item.unitOfMeasure,
        reorderPoint: n(item.reorderPoint),
        onHand: qtyByItem.get(item.id) ?? 0,
      }))}
      locations={locations.map((location) => ({
        id: location.id,
        name: location.name,
        kind: location.kind,
        projectId: location.projectId || "",
        projectName: location.project?.name || "",
      }))}
      balances={balances.map((row) => ({
        id: row.id,
        itemId: row.itemId,
        itemName: row.item.name,
        unitOfMeasure: row.item.unitOfMeasure,
        locationId: row.locationId,
        locationName: row.location.name,
        quantity: n(row.quantity),
        reorderPoint: n(row.item.reorderPoint),
      }))}
      movements={movements.map((row) => ({
        id: row.id,
        type: row.type,
        itemName: row.item.name,
        unitOfMeasure: row.item.unitOfMeasure,
        quantity: n(row.quantity),
        fromName: row.fromLocation?.name || "",
        toName: row.toLocation?.name || "",
        projectName: row.project?.name || "",
        notes: row.notes || "",
        recordedByLabel: row.recordedByLabel,
        createdAt: dateLabel(row.createdAt),
        createdAtValue: row.createdAt.toISOString(),
      }))}
      assets={assets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        serialNumber: asset.serialNumber || "",
        status: asset.status,
        itemName: asset.item.name,
        projectName: asset.project?.name || "",
        lastServiceAt: dateLabel(asset.lastServiceAt),
        nextServiceAt: dateLabel(asset.nextServiceAt),
        nextServiceValue: asset.nextServiceAt?.toISOString() || "",
        overdue: Boolean(asset.nextServiceAt && asset.nextServiceAt < now),
        serviceIntervalDays: asset.serviceIntervalDays || 0,
      }))}
      damages={damages.map((row) => ({
        id: row.id,
        status: row.status,
        description: row.description,
        itemName: row.item?.name || "",
        assetName: row.asset?.name || "",
        projectName: row.project?.name || "",
        quantity: row.quantity == null ? null : n(row.quantity),
        estimatedCost: row.estimatedCost == null ? null : n(row.estimatedCost),
        photoUrl: row.photoUrl || "",
        reportedByLabel: row.reportedByLabel,
        confirmedByLabel: row.confirmedByLabel || "",
        createdAt: dateLabel(row.createdAt),
      }))}
      projects={projects}
      units={units}
      weekUsage={movements
        .filter((row) => row.type === "ISSUE" && row.createdAt >= weekAgo)
        .reduce((sum, row) => sum + n(row.quantity), 0)}
    />
  );
}
