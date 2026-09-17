import { z } from "zod";
import { InventoryItemClass, InventoryPartyKind } from "@/generated/prisma";

export const inventoryItemSchema = z.object({
  name: z.string().trim().min(2).max(120),
  sku: z.string().trim().max(40).optional().or(z.literal("")),
  itemClass: z.nativeEnum(InventoryItemClass),
  unitOfMeasure: z.string().trim().min(1).max(24),
  reorderPoint: z.coerce.number().min(0).max(1_000_000),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export const inventoryPartySchema = z.object({
  kind: z.nativeEnum(InventoryPartyKind),
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email().optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  specialty: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  isActive: z.boolean().optional(),
});

export const inventoryReceiveSchema = z.object({
  itemId: z.string().min(1),
  toLocationId: z.string().min(1),
  quantity: z.coerce.number().positive().max(1_000_000),
  unitPrice: z.coerce.number().min(0).max(1_000_000_000).optional(),
  partyId: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  currency: z.string().trim().min(3).max(3).optional().or(z.literal("")),
});

export const inventoryManualPriceSchema = z.object({
  itemId: z.string().min(1),
  unitPrice: z.coerce.number().positive().max(1_000_000_000),
  effectiveAt: z.string().optional().or(z.literal("")),
  partyId: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  currency: z.string().trim().min(3).max(3).optional().or(z.literal("")),
});
