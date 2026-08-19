import "server-only";

import { InventoryItemClass, InventoryLocationKind, type Prisma } from "@/generated/prisma";
import prisma from "@/lib/db";

type Db = Prisma.TransactionClient | typeof prisma;

const DEFAULT_ITEMS: Array<{
  name: string;
  sku: string;
  itemClass: InventoryItemClass;
  unitOfMeasure: string;
  reorderPoint: number;
}> = [
  { name: "Cement", sku: "CEMENT-50KG", itemClass: InventoryItemClass.MATERIAL, unitOfMeasure: "bag", reorderPoint: 50 },
  { name: "Sharp sand", sku: "SAND-SHARP", itemClass: InventoryItemClass.MATERIAL, unitOfMeasure: "tonne", reorderPoint: 10 },
  { name: "Granite", sku: "GRANITE", itemClass: InventoryItemClass.MATERIAL, unitOfMeasure: "tonne", reorderPoint: 8 },
  { name: "Iron rod", sku: "IRON-ROD", itemClass: InventoryItemClass.MATERIAL, unitOfMeasure: "length", reorderPoint: 40 },
  { name: "Diesel", sku: "DIESEL", itemClass: InventoryItemClass.CONSUMABLE, unitOfMeasure: "litre", reorderPoint: 200 },
  { name: "Concrete mixer", sku: "MIXER", itemClass: InventoryItemClass.EQUIPMENT, unitOfMeasure: "unit", reorderPoint: 0 },
  { name: "Generator", sku: "GENERATOR", itemClass: InventoryItemClass.EQUIPMENT, unitOfMeasure: "unit", reorderPoint: 0 },
];

export async function ensureFacilityDefaults(tenantId: string) {
  const [existingCentral, existingItems, projects] = await Promise.all([
    prisma.inventoryLocation.findFirst({
      where: { tenantId, kind: InventoryLocationKind.CENTRAL },
      select: { id: true },
    }),
    prisma.inventoryItem.findMany({
      where: { tenantId },
      select: { sku: true, name: true },
    }),
    prisma.project.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    }),
  ]);

  if (!existingCentral) {
    await prisma.inventoryLocation.create({
      data: { tenantId, name: "Central store", kind: InventoryLocationKind.CENTRAL },
    });
  }

  const known = new Set(
    existingItems.flatMap((item) => [item.sku, item.name.toLowerCase()].filter(Boolean) as string[]),
  );
  const missing = DEFAULT_ITEMS.filter(
    (item) => !known.has(item.sku) && !known.has(item.name.toLowerCase()),
  );
  if (missing.length) {
    await prisma.inventoryItem.createMany({
      data: missing.map((item) => ({ tenantId, ...item })),
    });
  }

  const projectStores = await prisma.inventoryLocation.findMany({
    where: { tenantId, kind: InventoryLocationKind.PROJECT },
    select: { projectId: true },
  });
  const haveStore = new Set(projectStores.map((row) => row.projectId).filter(Boolean));
  const missingStores = projects.filter((project) => !haveStore.has(project.id));
  if (missingStores.length) {
    await prisma.inventoryLocation.createMany({
      data: missingStores.map((project) => ({
        tenantId,
        name: `${project.name} store`,
        kind: InventoryLocationKind.PROJECT,
        projectId: project.id,
      })),
    });
  }
}

export async function applyInventoryQuantityChange(
  input: {
    tenantId: string;
    itemId: string;
    locationId: string;
    delta: number;
  },
  db: Db = prisma,
) {
  const existing = await db.inventoryBalance.findUnique({
    where: { itemId_locationId: { itemId: input.itemId, locationId: input.locationId } },
  });
  const next = Number(existing?.quantity ?? 0) + input.delta;
  if (!existing) {
    await db.inventoryBalance.create({
      data: {
        tenantId: input.tenantId,
        itemId: input.itemId,
        locationId: input.locationId,
        quantity: next,
      },
    });
    return next;
  }
  await db.inventoryBalance.update({
    where: { id: existing.id },
    data: { quantity: next },
  });
  return next;
}
