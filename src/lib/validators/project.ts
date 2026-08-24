import { UnitPurpose, UnitStatus } from "@/generated/prisma";
import { z } from "zod";

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Project name must be at least 2 characters.")
    .max(120, "Project name is too long."),
  basePrice: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined))
    .refine((v) => !v || !Number.isNaN(Number(v)), "Base price must be a valid number."),
  currency: z.string().trim().min(3).max(3).optional(),
  serviceCharge: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined))
    .refine((v) => !v || !Number.isNaN(Number(v)), "Service charge must be a valid number."),
});

export const createUnitSchema = z.object({
  label: z.string().trim().min(1, "Unit label is required.").max(80, "Unit label is too long."),
  purpose: z.nativeEnum(UnitPurpose),
  unitType: z.string().trim().max(80, "Unit type is too long.").optional(),
  status: z.nativeEnum(UnitStatus).optional(),
  pricingPlanId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
});

export const createPricingPlanSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Plan name must be at least 2 characters.")
    .max(120, "Plan name is too long."),
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
    serviceCharge: formData.get("serviceCharge"),
  });
}

export function parseCreateUnitForm(formData: FormData) {
  const purposeRaw = formData.get("purpose");
  const purposeValues = Object.values(UnitPurpose) as string[];
  const purpose =
    typeof purposeRaw === "string" && purposeRaw !== "" && purposeValues.includes(purposeRaw)
      ? (purposeRaw as UnitPurpose)
      : UnitPurpose.SALE;

  return createUnitSchema.safeParse({
    label: formData.get("label"),
    purpose,
    unitType: formData.get("unitType") || undefined,
    status: formData.get("status") || UnitStatus.AVAILABLE,
    pricingPlanId: formData.get("pricingPlanId") || undefined,
  });
}

const bulkUnitSharedSchema = z.object({
  purpose: z.nativeEnum(UnitPurpose),
  unitType: z.string().trim().max(80, "Unit type is too long.").optional(),
  status: z.nativeEnum(UnitStatus).optional(),
  pricingPlanId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
});

export const createUnitsBulkSchema = bulkUnitSharedSchema.extend({
  labels: z
    .array(z.string().trim().min(1, "Unit label is required.").max(80, "Unit label is too long."))
    .min(1, "Add at least one unit.")
    .max(50, "You can add up to 50 units at once."),
});

export function parseCreateUnitsBulkForm(formData: FormData) {
  const purposeRaw = formData.get("purpose");
  const purposeValues = Object.values(UnitPurpose) as string[];
  const purpose =
    typeof purposeRaw === "string" && purposeRaw !== "" && purposeValues.includes(purposeRaw)
      ? (purposeRaw as UnitPurpose)
      : UnitPurpose.SALE;

  let labels: string[] = [];
  const rawLabels = formData.get("labels");
  if (typeof rawLabels === "string" && rawLabels.trim()) {
    try {
      const parsed = JSON.parse(rawLabels) as unknown;
      if (Array.isArray(parsed)) {
        labels = parsed
          .filter((x): x is string => typeof x === "string")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    } catch {
      labels = [];
    }
  }

  return createUnitsBulkSchema.safeParse({
    labels,
    purpose,
    unitType: formData.get("unitType") || undefined,
    status: formData.get("status") || UnitStatus.AVAILABLE,
    pricingPlanId: formData.get("pricingPlanId") || undefined,
  });
}

export function parseAmenitiesFromForm(formData: FormData): string[] {
  const raw = formData.get("amenities");
  if (typeof raw === "string" && raw.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((a): a is string => typeof a === "string")
          .map((a) => a.trim())
          .filter(Boolean)
          .slice(0, 20);
      }
    } catch {
      // fall through
    }
  }
  return ((raw as string) ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean)
    .slice(0, 20);
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

export const parseUpdatePricingPlanForm = parseCreatePricingPlanForm;
