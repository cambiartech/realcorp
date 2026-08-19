"use server";

import { auth } from "@/auth";
import {
  InventoryDamageStatus,
  InventoryItemClass,
  InventoryLocationKind,
  InventoryMovementType,
  MembershipStatus,
} from "@/generated/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import { createTenantUploadSignature } from "@/lib/cloudinary-upload-server";
import prisma from "@/lib/db";
import { canManageFacility, canRecordFacility, canViewFacilityModule } from "@/lib/facility-access";
import { applyInventoryQuantityChange } from "@/lib/facility-server";
import {
  facilityAssetSchema,
  facilityDamageSchema,
  facilityDamageStatusSchema,
  facilityItemSchema,
  facilityMovementSchema,
  facilityServiceSchema,
} from "@/lib/validators/facility";
import { revalidatePath } from "next/cache";

async function facilityContext(tenantSlug: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false as const, error: "You must be signed in." };
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      slug: true,
      settings: { select: { moduleFacility: true } },
    },
  });
  if (!tenant) return { ok: false as const, error: "Organization not found." };
  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { status: true, role: true, modulePermissions: true },
  });
  if (membership?.status !== MembershipStatus.ACTIVE && !session.user.isPlatformAdmin) {
    return { ok: false as const, error: "You do not have access to this organization." };
  }
  const access = {
    isPlatformAdmin: Boolean(session.user.isPlatformAdmin),
    membership,
    moduleFacility: Boolean(tenant.settings?.moduleFacility),
  };
  if (!canViewFacilityModule(access)) {
    return { ok: false as const, error: "Facility is not available for your role." };
  }
  const actorLabel = session.user.name || session.user.email || "Team member";
  return { ok: true as const, session, tenant, membership, access, actorLabel };
}

function revalidateFacility(tenantSlug: string) {
  revalidatePath(`/${tenantSlug}/facility`);
}

function emptyToNull(value?: string) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function parseDay(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return null;
  const date = new Date(`${raw}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createFacilityItem(tenantSlug: string, raw: unknown) {
  const ctx = await facilityContext(tenantSlug);
  if (!ctx.ok) return ctx;
  if (!canManageFacility(ctx.access)) return { ok: false as const, error: "Only a Facility Manager can edit the catalog." };
  const parsed = facilityItemSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Check the item details and try again." };
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
    module: "FACILITY",
    entityType: "INVENTORY_ITEM",
    entityId: item.id,
    action: "CREATE",
    summary: `Added catalog item ${item.name}.`,
  });
  revalidateFacility(tenantSlug);
  return { ok: true as const };
}

export async function recordFacilityMovement(tenantSlug: string, raw: unknown) {
  const ctx = await facilityContext(tenantSlug);
  if (!ctx.ok) return ctx;
  if (!canRecordFacility(ctx.access)) return { ok: false as const, error: "You cannot record stock movements." };
  const parsed = facilityMovementSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Check the quantity and locations." };
  const fromId = emptyToNull(parsed.data.fromLocationId);
  const toId = emptyToNull(parsed.data.toLocationId);
  const type = parsed.data.type;
  if (type === InventoryMovementType.RECEIVE && !toId) {
    return { ok: false as const, error: "Choose the store that received this stock." };
  }
  if ((type === InventoryMovementType.ISSUE || type === InventoryMovementType.DAMAGE) && !fromId) {
    return { ok: false as const, error: "Choose the store this stock left." };
  }
  if (type === InventoryMovementType.TRANSFER && (!fromId || !toId || fromId === toId)) {
    return { ok: false as const, error: "Choose two different stores for a transfer." };
  }
  if (type === InventoryMovementType.ADJUST && !toId && !fromId) {
    return { ok: false as const, error: "Choose a store to adjust." };
  }

  const qty = parsed.data.quantity;
  const item = await prisma.inventoryItem.findFirst({
    where: { id: parsed.data.itemId, tenantId: ctx.tenant.id, isActive: true },
    select: { id: true, name: true, itemClass: true },
  });
  if (!item) return { ok: false as const, error: "That catalog item was not found." };
  if (item.itemClass === InventoryItemClass.EQUIPMENT) {
    return { ok: false as const, error: "Plant and machinery is tracked on the Plant tab, not as bags of stock." };
  }

  if (fromId) {
    const onHand = await prisma.inventoryBalance.findUnique({
      where: { itemId_locationId: { itemId: item.id, locationId: fromId } },
    });
    if (Number(onHand?.quantity ?? 0) < qty && type !== InventoryMovementType.ADJUST) {
      return { ok: false as const, error: "Not enough stock in that store." };
    }
  }

  const fromLocation = fromId
    ? await prisma.inventoryLocation.findFirst({ where: { id: fromId, tenantId: ctx.tenant.id } })
    : null;
  const projectId =
    emptyToNull(parsed.data.projectId) ||
    (fromLocation?.kind === InventoryLocationKind.PROJECT ? fromLocation.projectId : null) ||
    undefined;

  await prisma.$transaction(async (tx) => {
    await tx.inventoryMovement.create({
      data: {
        tenantId: ctx.tenant.id,
        itemId: item.id,
        type,
        quantity: qty,
        fromLocationId: fromId,
        toLocationId: type === InventoryMovementType.ADJUST ? toId || fromId : toId,
        projectId: projectId || null,
        unitId: emptyToNull(parsed.data.unitId),
        notes: emptyToNull(parsed.data.notes),
        recordedByUserId: ctx.session.user.id,
        recordedByLabel: ctx.actorLabel,
      },
    });
    if (type === InventoryMovementType.RECEIVE && toId) {
      await applyInventoryQuantityChange({ tenantId: ctx.tenant.id, itemId: item.id, locationId: toId, delta: qty }, tx);
    } else if (type === InventoryMovementType.TRANSFER && fromId && toId) {
      await applyInventoryQuantityChange(
        { tenantId: ctx.tenant.id, itemId: item.id, locationId: fromId, delta: -qty },
        tx,
      );
      await applyInventoryQuantityChange({ tenantId: ctx.tenant.id, itemId: item.id, locationId: toId, delta: qty }, tx);
    } else if ((type === InventoryMovementType.ISSUE || type === InventoryMovementType.DAMAGE) && fromId) {
      await applyInventoryQuantityChange(
        { tenantId: ctx.tenant.id, itemId: item.id, locationId: fromId, delta: -qty },
        tx,
      );
    } else if (type === InventoryMovementType.ADJUST) {
      const locationId = toId || fromId;
      if (locationId) {
        await applyInventoryQuantityChange(
          {
            tenantId: ctx.tenant.id,
            itemId: item.id,
            locationId,
            delta: qty,
          },
          tx,
        );
      }
    }
  });

  await writeAuditLog({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.session.user.id,
    actorLabel: ctx.actorLabel,
    module: "FACILITY",
    entityType: "INVENTORY_MOVEMENT",
    action: type,
    summary: `${type.toLowerCase()} ${qty} ${item.name}.`,
  });
  revalidateFacility(tenantSlug);
  return { ok: true as const };
}

export async function createFacilityAsset(tenantSlug: string, raw: unknown) {
  const ctx = await facilityContext(tenantSlug);
  if (!ctx.ok) return ctx;
  if (!canManageFacility(ctx.access)) return { ok: false as const, error: "Only a Facility Manager can add plant." };
  const parsed = facilityAssetSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Check the plant details and try again." };
  const item = await prisma.inventoryItem.findFirst({
    where: { id: parsed.data.itemId, tenantId: ctx.tenant.id },
    select: { id: true, itemClass: true },
  });
  if (!item) return { ok: false as const, error: "Choose a catalog type for this machine." };
  const asset = await prisma.inventoryAsset.create({
    data: {
      tenantId: ctx.tenant.id,
      itemId: item.id,
      name: parsed.data.name,
      serialNumber: emptyToNull(parsed.data.serialNumber),
      status: parsed.data.status,
      projectId: emptyToNull(parsed.data.projectId),
      locationId: emptyToNull(parsed.data.locationId),
      lastServiceAt: parseDay(parsed.data.lastServiceAt),
      nextServiceAt: parseDay(parsed.data.nextServiceAt),
      serviceIntervalDays: parsed.data.serviceIntervalDays || null,
      notes: emptyToNull(parsed.data.notes),
    },
  });
  await writeAuditLog({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.session.user.id,
    actorLabel: ctx.actorLabel,
    module: "FACILITY",
    entityType: "INVENTORY_ASSET",
    entityId: asset.id,
    action: "CREATE",
    summary: `Registered plant ${asset.name}.`,
  });
  revalidateFacility(tenantSlug);
  return { ok: true as const };
}

export async function logFacilityService(tenantSlug: string, raw: unknown) {
  const ctx = await facilityContext(tenantSlug);
  if (!ctx.ok) return ctx;
  if (!canRecordFacility(ctx.access)) return { ok: false as const, error: "You cannot log a service." };
  const parsed = facilityServiceSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Enter the service date." };
  const servicedAt = parseDay(parsed.data.servicedAt);
  if (!servicedAt) return { ok: false as const, error: "Enter a valid service date." };
  const asset = await prisma.inventoryAsset.findFirst({
    where: { id: parsed.data.assetId, tenantId: ctx.tenant.id },
  });
  if (!asset) return { ok: false as const, error: "That machine was not found." };
  const nextDueAt =
    parseDay(parsed.data.nextDueAt) ||
    (asset.serviceIntervalDays
      ? new Date(servicedAt.getTime() + asset.serviceIntervalDays * 24 * 60 * 60 * 1000)
      : null);
  await prisma.$transaction([
    prisma.inventoryServiceLog.create({
      data: {
        tenantId: ctx.tenant.id,
        assetId: asset.id,
        servicedAt,
        nextDueAt,
        notes: emptyToNull(parsed.data.notes),
        recordedByUserId: ctx.session.user.id,
        recordedByLabel: ctx.actorLabel,
      },
    }),
    prisma.inventoryAsset.update({
      where: { id: asset.id },
      data: {
        lastServiceAt: servicedAt,
        nextServiceAt: nextDueAt,
        status: "AVAILABLE",
      },
    }),
  ]);
  await writeAuditLog({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.session.user.id,
    actorLabel: ctx.actorLabel,
    module: "FACILITY",
    entityType: "INVENTORY_SERVICE",
    entityId: asset.id,
    action: "CREATE",
    summary: `Logged service for ${asset.name}.`,
  });
  revalidateFacility(tenantSlug);
  return { ok: true as const };
}

export async function reportFacilityDamage(tenantSlug: string, raw: unknown) {
  const ctx = await facilityContext(tenantSlug);
  if (!ctx.ok) return ctx;
  if (!canRecordFacility(ctx.access)) return { ok: false as const, error: "You cannot report damage." };
  const parsed = facilityDamageSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Describe what was damaged." };
  if (!emptyToNull(parsed.data.itemId) && !emptyToNull(parsed.data.assetId)) {
    return { ok: false as const, error: "Choose a material or a machine." };
  }
  const itemId = emptyToNull(parsed.data.itemId);
  const assetId = emptyToNull(parsed.data.assetId);
  const locationId = emptyToNull(parsed.data.locationId);
  const qty = parsed.data.quantity || 0;
  let damageId = "";
  try {
    const damage = await prisma.$transaction(async (tx) => {
      if (itemId && locationId && qty > 0) {
        const item = await tx.inventoryItem.findFirst({
          where: { id: itemId, tenantId: ctx.tenant.id, isActive: true },
          select: { id: true, itemClass: true },
        });
        if (!item || item.itemClass === InventoryItemClass.EQUIPMENT) {
          throw new Error("Choose a material from the catalog for this write-off.");
        }
        const onHand = await tx.inventoryBalance.findUnique({
          where: { itemId_locationId: { itemId: item.id, locationId } },
        });
        if (Number(onHand?.quantity ?? 0) < qty) {
          throw new Error("Not enough stock in that store.");
        }
        await tx.inventoryMovement.create({
          data: {
            tenantId: ctx.tenant.id,
            itemId: item.id,
            type: InventoryMovementType.DAMAGE,
            quantity: qty,
            fromLocationId: locationId,
            projectId: emptyToNull(parsed.data.projectId),
            notes: parsed.data.description,
            recordedByUserId: ctx.session.user.id,
            recordedByLabel: ctx.actorLabel,
          },
        });
        await applyInventoryQuantityChange(
          { tenantId: ctx.tenant.id, itemId: item.id, locationId, delta: -qty },
          tx,
        );
      }
      if (assetId) {
        await tx.inventoryAsset.updateMany({
          where: { id: assetId, tenantId: ctx.tenant.id },
          data: { status: "DAMAGED" },
        });
      }
      return tx.inventoryDamage.create({
        data: {
          tenantId: ctx.tenant.id,
          itemId,
          assetId,
          projectId: emptyToNull(parsed.data.projectId),
          locationId,
          quantity: parsed.data.quantity || null,
          description: parsed.data.description,
          estimatedCost: parsed.data.estimatedCost || null,
          photoUrl: emptyToNull(parsed.data.photoUrl),
          reportedByUserId: ctx.session.user.id,
          reportedByLabel: ctx.actorLabel,
        },
      });
    });
    damageId = damage.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save that damage report.";
    return { ok: false as const, error: message };
  }
  await writeAuditLog({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.session.user.id,
    actorLabel: ctx.actorLabel,
    module: "FACILITY",
    entityType: "INVENTORY_DAMAGE",
    entityId: damageId,
    action: "CREATE",
    summary: "Reported a facility damage.",
  });
  revalidateFacility(tenantSlug);
  return { ok: true as const };
}

export async function updateFacilityDamageStatus(tenantSlug: string, raw: unknown) {
  const ctx = await facilityContext(tenantSlug);
  if (!ctx.ok) return ctx;
  if (!canManageFacility(ctx.access)) return { ok: false as const, error: "Only a Facility Manager can confirm damages." };
  const parsed = facilityDamageStatusSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: "Choose a status." };
  await prisma.inventoryDamage.updateMany({
    where: { id: parsed.data.damageId, tenantId: ctx.tenant.id },
    data: {
      status: parsed.data.status,
      confirmedByLabel:
        parsed.data.status === InventoryDamageStatus.OPEN ? null : ctx.actorLabel,
    },
  });
  revalidateFacility(tenantSlug);
  return { ok: true as const };
}

export async function getFacilityUploadSignature(tenantSlug: string, fileName: string) {
  const ctx = await facilityContext(tenantSlug);
  if (!ctx.ok) return ctx;
  if (!canRecordFacility(ctx.access)) return { ok: false as const, error: "You cannot upload files." };
  return createTenantUploadSignature({
    tenantId: ctx.tenant.id,
    tenantSlug: ctx.tenant.slug,
    area: "facility",
    fileName,
  });
}
