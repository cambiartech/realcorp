import { UnitStatus } from "@/generated/prisma";
import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, "Project name must be at least 2 characters.").max(120, "Project name is too long."),
  basePrice: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined))
    .refine((v) => !v || !Number.isNaN(Number(v)), "Base price must be a valid number."),
  currency: z.string().trim().min(3).max(3).optional(),
});

export const createUnitSchema = z.object({
  label: z.string().trim().min(1, "Unit label is required.").max(80, "Unit label is too long."),
  unitType: z.string().trim().max(80, "Unit type is too long.").optional(),
  status: z.nativeEnum(UnitStatus).optional(),
  pricingPlanId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
});

export const createPricingPlanSchema = z.object({
  name: z.string().trim().min(2, "Plan name must be at least 2 characters.").max(120, "Plan name is too long."),
  price: z
    .string()
    .trim()
    .min(1, "Price is required.")
    .refine((v) => !Number.isNaN(Number(v)), "Price must be a valid number."),
  currency: z.string().trim().min(3).max(3).default("NGN"),
  initialDeposit: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined))
    .refine((v) => !v || !Number.isNaN(Number(v)), "Initial deposit must be a valid number."),
  paymentDurationMonths: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined))
    .refine((v) => !v || (!Number.isNaN(Number(v)) && Number(v) > 0), "Duration must be a positive number."),
});

export function parseCreateProjectForm(formData: FormData) {
  return createProjectSchema.safeParse({
    name: formData.get("name"),
    basePrice: formData.get("basePrice"),
    currency: formData.get("currency"),
  });
}

export function parseCreateUnitForm(formData: FormData) {
  return createUnitSchema.safeParse({
    label: formData.get("label"),
    unitType: formData.get("unitType") || undefined,
    status: formData.get("status") || UnitStatus.AVAILABLE,
    pricingPlanId: formData.get("pricingPlanId") || undefined,
  });
}

export function parseCreatePricingPlanForm(formData: FormData) {
  return createPricingPlanSchema.safeParse({
    name: formData.get("name"),
    price: formData.get("price"),
    currency: formData.get("currency") || "NGN",
    initialDeposit: formData.get("initialDeposit"),
    paymentDurationMonths: formData.get("paymentDurationMonths"),
  });
}
