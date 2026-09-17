"use server";

import { auth } from "@/auth";
import {
  InventoryItemClass,
  InventoryMovementType,
  InventoryPartyKind,
  InventoryPriceSource,
  MembershipStatus,
} from "@/generated/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import prisma from "@/lib/db";
import { canManageInventory, canRecordInventory, canViewInventoryModule } from "@/lib/inventory-access";
import { applyInventoryQuantityChange, ensureFacilityDefaults } from "@/lib/facility-server";
import {
  inventoryItemSchema,
  inventoryManualPriceSchema,
  inventoryPartySchema,
  inventoryReceiveSchema,
} from "@/lib/validators/inventory";
import { revalidatePath } from "next/cache";

function emptyToNull(value?: string | null) {
  const trimmed = (value || "").trim();
  return trimmed ? trimmed : null;
}

async function inventoryContext(tenantSlug: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "You must be signed in." };
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      slug: true,
      defaultCurrency: true,
      settings: { select: { moduleInventory: true, payrollCountryCode: true } },
    },
  });
  if (!tenant) return { ok: false as const, error: "Organization not found." };
  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { status: true, role: true, modulePermissions: true },
  });
  if (membership && membership.status !== MembershipStatus.ACTIVE && !session.user.isPlatformAdmin) {
    return { ok: false as const, error: "No access." };
  }
  const access = {
    isPlatformAdmin: Boolean(session.user.isPlatformAdmin),
    membership,
    moduleInventory: Boolean(tenant.settings?.moduleInventory),
  };
  if (!canViewInventoryModule(access)) return { ok: false as const, error: "Inventory is not available." };
  const actorLabel = session.user.name || session.user.email || "Staff";
  return { ok: true as const, session, tenant, access, actorLabel };
}

function revalidateInventory(tenantSlug: string) {
  revalidatePath(`/${tenantSlug}/inventory`);
  revalidatePath(`/${tenantSlug}/facility`);
}

export async function createInventoryItem(tenantSlug: string, raw: unknown) {
  const ctx = await inventoryContext(tenantSlug);
  if (!ctx.ok) return ctx;
  if (!canManageInventory(ctx.access)) return { ok: false as const, error: "You cannot edit the catalog." };
  const parsed = inventoryItemSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Check the catalog fields." };
  await ensureFacilityDefaults(ctx.tenant.id);
  const item = await prisma.inventoryItem.create({
    data: {
      tenantId: ctx.tenant.id,
      name: parsed.data.name,
      sku: emptyToNull(parsed.data.sku),
      itemClass: parsed.data.itemClass,
      unitOfMeasure: parsed.data.unitOfMeasure,
      reorderPoint: parsed.data.reorderPoint,
      notes: emptyToNull(parsed.data.notes),
    },
  });
  await writeAuditLog({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.session.user.id,
    actorLabel: ctx.actorLabel,
    module: "INVENTORY",
    entityType: "InventoryItem",
    entityId: item.id,
    action: "CREATE",
    summary: `Added catalog item ${item.name}.`,
  });
  revalidateInventory(tenantSlug);
  return { ok: true as const };
}

export async function upsertInventoryParty(tenantSlug: string, raw: unknown) {
  const ctx = await inventoryContext(tenantSlug);
  if (!ctx.ok) return ctx;
  if (!canManageInventory(ctx.access)) return { ok: false as const, error: "You cannot manage contacts." };
  const parsed = inventoryPartySchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Check the contact fields." };
  const data = {
    tenantId: ctx.tenant.id,
    kind: parsed.data.kind,
    name: parsed.data.name,
    phone: emptyToNull(parsed.data.phone),
    email: emptyToNull(parsed.data.email),
    address: emptyToNull(parsed.data.address),
    specialty: emptyToNull(parsed.data.specialty),
    notes: emptyToNull(parsed.data.notes),
    isActive: parsed.data.isActive ?? true,
  };
  const id = typeof raw === "object" && raw && "id" in raw ? String((raw as { id?: string }).id || "") : "";
  const party = id
    ? await prisma.inventoryParty.updateMany({
        where: { id, tenantId: ctx.tenant.id },
        data: {
          name: data.name,
          phone: data.phone,
          email: data.email,
          address: data.address,
          specialty: data.specialty,
          notes: data.notes,
          isActive: data.isActive,
        },
      }).then(async () => prisma.inventoryParty.findFirst({ where: { id, tenantId: ctx.tenant.id } }))
    : await prisma.inventoryParty.create({ data });
  if (!party) return { ok: false as const, error: "Contact not found." };
  await writeAuditLog({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.session.user.id,
    actorLabel: ctx.actorLabel,
    module: "INVENTORY",
    entityType: "InventoryParty",
    entityId: party.id,
    action: id ? "UPDATE" : "CREATE",
    summary: `${id ? "Updated" : "Added"} ${party.kind.toLowerCase()} ${party.name}.`,
  });
  revalidateInventory(tenantSlug);
  return { ok: true as const };
}

export async function setInventoryPartyActive(tenantSlug: string, partyId: string, isActive: boolean) {
  const ctx = await inventoryContext(tenantSlug);
  if (!ctx.ok) return ctx;
  if (!canManageInventory(ctx.access)) return { ok: false as const, error: "You cannot manage contacts." };
  const updated = await prisma.inventoryParty.updateMany({
    where: { id: partyId, tenantId: ctx.tenant.id },
    data: { isActive },
  });
  if (!updated.count) return { ok: false as const, error: "Contact not found." };
  revalidateInventory(tenantSlug);
  return { ok: true as const };
}

export async function receiveInventoryStock(tenantSlug: string, raw: unknown) {
  const ctx = await inventoryContext(tenantSlug);
  if (!ctx.ok) return ctx;
  if (!canRecordInventory(ctx.access)) return { ok: false as const, error: "You cannot receive stock." };
  const parsed = inventoryReceiveSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Check quantity, store, and price." };

  const item = await prisma.inventoryItem.findFirst({
    where: { id: parsed.data.itemId, tenantId: ctx.tenant.id, isActive: true },
    select: { id: true, name: true, itemClass: true },
  });
  if (!item) return { ok: false as const, error: "That catalog item was not found." };
  if (item.itemClass === InventoryItemClass.EQUIPMENT) {
    return { ok: false as const, error: "Plant and machinery is tracked under Facility → Plant." };
  }

  const location = await prisma.inventoryLocation.findFirst({
    where: { id: parsed.data.toLocationId, tenantId: ctx.tenant.id, isActive: true },
    select: { id: true },
  });
  if (!location) return { ok: false as const, error: "Choose a valid store." };

  const partyId = emptyToNull(parsed.data.partyId);
  if (partyId) {
    const party = await prisma.inventoryParty.findFirst({
      where: { id: partyId, tenantId: ctx.tenant.id, kind: InventoryPartyKind.SUPPLIER, isActive: true },
      select: { id: true },
    });
    if (!party) return { ok: false as const, error: "Choose an active supplier." };
  }

  const qty = parsed.data.quantity;
  const unitPrice =
    parsed.data.unitPrice != null && Number.isFinite(parsed.data.unitPrice) ? parsed.data.unitPrice : null;
  const currency = (parsed.data.currency || ctx.tenant.defaultCurrency || "NGN").toUpperCase();

  const movement = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryMovement.create({
      data: {
        tenantId: ctx.tenant.id,
        itemId: item.id,
        type: InventoryMovementType.RECEIVE,
        quantity: qty,
        unitPrice,
        partyId,
        toLocationId: location.id,
        notes: emptyToNull(parsed.data.notes),
        recordedByUserId: ctx.session.user.id,
        recordedByLabel: ctx.actorLabel,
      },
    });
    await applyInventoryQuantityChange(
      { tenantId: ctx.tenant.id, itemId: item.id, locationId: location.id, delta: qty },
      tx,
    );
    if (unitPrice != null && unitPrice >= 0) {
      await tx.inventoryPricePoint.create({
        data: {
          tenantId: ctx.tenant.id,
          itemId: item.id,
          unitPrice,
          currency,
          effectiveAt: created.createdAt,
          source: InventoryPriceSource.RECEIVE,
          partyId,
          movementId: created.id,
          notes: emptyToNull(parsed.data.notes),
          recordedByUserId: ctx.session.user.id,
          recordedByLabel: ctx.actorLabel,
        },
      });
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { currentUnitPrice: unitPrice },
      });
    }
    return created;
  });

  await writeAuditLog({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.session.user.id,
    actorLabel: ctx.actorLabel,
    module: "INVENTORY",
    entityType: "InventoryMovement",
    entityId: movement.id,
    action: "RECEIVE",
    summary: `Received ${qty} of ${item.name}${unitPrice != null ? ` @ ${currency} ${unitPrice}` : ""}.`,
  });
  revalidateInventory(tenantSlug);
  return { ok: true as const };
}

export async function recordManualInventoryPrice(tenantSlug: string, raw: unknown) {
  const ctx = await inventoryContext(tenantSlug);
  if (!ctx.ok) return ctx;
  if (!canManageInventory(ctx.access)) return { ok: false as const, error: "You cannot update prices." };
  const parsed = inventoryManualPriceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Check the price fields." };

  const item = await prisma.inventoryItem.findFirst({
    where: { id: parsed.data.itemId, tenantId: ctx.tenant.id, isActive: true },
    select: { id: true, name: true },
  });
  if (!item) return { ok: false as const, error: "That catalog item was not found." };

  const partyId = emptyToNull(parsed.data.partyId);
  if (partyId) {
    const party = await prisma.inventoryParty.findFirst({
      where: { id: partyId, tenantId: ctx.tenant.id, isActive: true },
      select: { id: true },
    });
    if (!party) return { ok: false as const, error: "Contact not found." };
  }

  const effectiveAt = parsed.data.effectiveAt ? new Date(parsed.data.effectiveAt) : new Date();
  if (Number.isNaN(effectiveAt.getTime())) return { ok: false as const, error: "Invalid effective date." };
  const currency = (parsed.data.currency || ctx.tenant.defaultCurrency || "NGN").toUpperCase();

  const point = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryPricePoint.create({
      data: {
        tenantId: ctx.tenant.id,
        itemId: item.id,
        unitPrice: parsed.data.unitPrice,
        currency,
        effectiveAt,
        source: InventoryPriceSource.MANUAL,
        partyId,
        notes: emptyToNull(parsed.data.notes),
        recordedByUserId: ctx.session.user.id,
        recordedByLabel: ctx.actorLabel,
      },
    });
    const latest = await tx.inventoryPricePoint.findFirst({
      where: { tenantId: ctx.tenant.id, itemId: item.id },
      orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
      select: { unitPrice: true },
    });
    if (latest) {
      await tx.inventoryItem.update({
        where: { id: item.id },
        data: { currentUnitPrice: latest.unitPrice },
      });
    }
    return created;
  });

  await writeAuditLog({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.session.user.id,
    actorLabel: ctx.actorLabel,
    module: "INVENTORY",
    entityType: "InventoryPricePoint",
    entityId: point.id,
    action: "MANUAL_PRICE",
    summary: `Manual price for ${item.name}: ${currency} ${parsed.data.unitPrice}.`,
  });
  revalidateInventory(tenantSlug);
  return { ok: true as const };
}
