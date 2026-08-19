import { z } from "zod";
import {
  InventoryAssetStatus,
  InventoryDamageStatus,
  InventoryItemClass,
  InventoryMovementType,
} from "@/generated/prisma";

export const facilityItemSchema = z.object({
  name: z.string().trim().min(2).max(120),
  sku: z.string().trim().max(40).optional().or(z.literal("")),
  itemClass: z.nativeEnum(InventoryItemClass),
  unitOfMeasure: z.string().trim().min(1).max(24),
  reorderPoint: z.coerce.number().min(0).max(1_000_000),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const facilityMovementSchema = z.object({
  itemId: z.string().min(1),
  type: z.nativeEnum(InventoryMovementType),
  quantity: z.coerce.number().positive().max(1_000_000),
  fromLocationId: z.string().optional().or(z.literal("")),
  toLocationId: z.string().optional().or(z.literal("")),
  projectId: z.string().optional().or(z.literal("")),
  unitId: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const facilityAssetSchema = z.object({
  itemId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  serialNumber: z.string().trim().max(80).optional().or(z.literal("")),
  status: z.nativeEnum(InventoryAssetStatus),
  projectId: z.string().optional().or(z.literal("")),
  locationId: z.string().optional().or(z.literal("")),
  lastServiceAt: z.string().optional().or(z.literal("")),
  nextServiceAt: z.string().optional().or(z.literal("")),
  serviceIntervalDays: z.coerce.number().int().min(0).max(3650).optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const facilityServiceSchema = z.object({
  assetId: z.string().min(1),
  servicedAt: z.string().min(1),
  nextDueAt: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const facilityDamageSchema = z.object({
  itemId: z.string().optional().or(z.literal("")),
  assetId: z.string().optional().or(z.literal("")),
  projectId: z.string().optional().or(z.literal("")),
  locationId: z.string().optional().or(z.literal("")),
  quantity: z.coerce.number().min(0).max(1_000_000).optional(),
  description: z.string().trim().min(4).max(1000),
  estimatedCost: z.coerce.number().min(0).max(1_000_000_000).optional(),
  photoUrl: z.string().url().optional().or(z.literal("")),
});

export const facilityDamageStatusSchema = z.object({
  damageId: z.string().min(1),
  status: z.nativeEnum(InventoryDamageStatus),
});
