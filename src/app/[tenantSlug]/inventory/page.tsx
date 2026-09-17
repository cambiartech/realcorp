import { InventoryWorkspace } from "@/app/[tenantSlug]/inventory/inventory-workspace";
import {
  canManageInventory,
  canRecordInventory,
  canViewInventoryModule,
} from "@/lib/inventory-access";
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

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

export default async function InventoryPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { session, tenant, membership } = await loadTenantRequest(tenantSlug);
  if (!session?.user?.id) await redirectToLogin(`/${tenantSlug}/inventory`);
  if (!tenant) notFound();

  const access = {
    isPlatformAdmin: Boolean(session.user.isPlatformAdmin),
    membership,
    moduleInventory: Boolean(normalizeSettingsNavSlice(tenant.settings).moduleInventory),
  };
  if (!canViewInventoryModule(access)) redirect(`/${tenantSlug}`);

  try {
    await ensureFacilityDefaults(tenant.id);
  } catch (error) {
    console.error("[inventory-defaults]", error);
  }

  const currency = tenant.defaultCurrency || "NGN";
  const [items, locations, balances, parties, pricePoints] = await Promise.all([
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
      include: {
        item: { select: { name: true, unitOfMeasure: true, reorderPoint: true } },
        location: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.inventoryParty.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ kind: "asc" }, { name: "asc" }],
    }),
    prisma.inventoryPricePoint.findMany({
      where: { tenantId: tenant.id },
      include: {
        item: { select: { name: true } },
        party: { select: { name: true } },
      },
      orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
      take: 500,
    }),
  ]);

  const qtyByItem = new Map<string, number>();
  for (const row of balances) {
    qtyByItem.set(row.itemId, (qtyByItem.get(row.itemId) ?? 0) + n(row.quantity));
  }

  const byItemChronological = new Map<string, typeof pricePoints>();
  for (const point of [...pricePoints].sort(
    (a, b) => a.effectiveAt.getTime() - b.effectiveAt.getTime() || a.createdAt.getTime() - b.createdAt.getTime(),
  )) {
    const list = byItemChronological.get(point.itemId) ?? [];
    list.push(point);
    byItemChronological.set(point.itemId, list);
  }

  const priceSummaries = items
    .map((item) => {
      const history = byItemChronological.get(item.id) ?? [];
      if (!history.length) return null;
      const latest = history[history.length - 1];
      const previous = history.length > 1 ? history[history.length - 2] : null;
      return {
        itemId: item.id,
        itemName: item.name,
        unitOfMeasure: item.unitOfMeasure,
        latest: n(latest.unitPrice),
        previous: previous ? n(previous.unitPrice) : null,
        lastPartyName: latest.party?.name || "",
        currency: latest.currency || currency,
      };
    })
    .filter(Boolean) as Array<{
    itemId: string;
    itemName: string;
    unitOfMeasure: string;
    latest: number | null;
    previous: number | null;
    lastPartyName: string;
    currency: string;
  }>;

  return (
    <InventoryWorkspace
      tenantSlug={tenantSlug}
      currency={currency}
      canManage={canManageInventory(access)}
      canRecord={canRecordInventory(access)}
      items={items.map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku || "",
        itemClass: item.itemClass,
        unitOfMeasure: item.unitOfMeasure,
        reorderPoint: n(item.reorderPoint),
        onHand: qtyByItem.get(item.id) ?? 0,
        currentUnitPrice: item.currentUnitPrice != null ? n(item.currentUnitPrice) : null,
      }))}
      locations={locations.map((loc) => ({
        id: loc.id,
        name: loc.name,
        kind: loc.kind,
        projectName: loc.project?.name || "",
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
      parties={parties.map((party) => ({
        id: party.id,
        kind: party.kind,
        name: party.name,
        phone: party.phone || "",
        email: party.email || "",
        address: party.address || "",
        specialty: party.specialty || "",
        notes: party.notes || "",
        isActive: party.isActive,
      }))}
      pricePoints={pricePoints.map((point) => ({
        id: point.id,
        itemId: point.itemId,
        itemName: point.item.name,
        unitPrice: n(point.unitPrice),
        currency: point.currency || currency,
        effectiveAt: dateLabel(point.effectiveAt),
        effectiveAtValue: point.effectiveAt.toISOString(),
        source: point.source,
        partyName: point.party?.name || "",
        notes: point.notes || "",
      }))}
      priceSummaries={priceSummaries}
    />
  );
}
