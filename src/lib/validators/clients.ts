import { ClientDocumentCategory, ClientUnitLinkRole, PropertyClientStatus } from "@/generated/prisma";
import { z } from "zod";

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v !== "" ? v : undefined))
  .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email, or leave it blank.");

export const createPropertyClientSchema = z.object({
  fullName: z.string().trim().min(2, "Client name must be at least 2 characters.").max(120),
  email: optionalEmail,
  phone: z.string().trim().max(40).optional(),
  alternatePhone: z.string().trim().max(40).optional(),
  addressLine: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  country: z.string().trim().max(80).optional(),
  status: z.nativeEnum(PropertyClientStatus).optional(),
  notes: z.string().trim().max(5000).optional(),
  sendPortalInvite: z.boolean().optional(),
});

export const updatePropertyClientSchema = createPropertyClientSchema;

export const linkClientUnitSchema = z.object({
  unitId: z.string().trim().min(1, "Select a unit."),
  pricingPlanId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  role: z.nativeEnum(ClientUnitLinkRole).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const addClientDocumentSchema = z.object({
  clientId: z.string().trim().min(1),
  category: z.nativeEnum(ClientDocumentCategory),
  title: z.string().trim().min(1, "Title is required.").max(200),
  fileUrl: z.string().url(),
  fileName: z.string().trim().max(255).optional(),
  visibleInPortal: z.boolean().optional(),
});

export function parseCreatePropertyClientForm(formData: FormData) {
  return createPropertyClientSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    alternatePhone: formData.get("alternatePhone") || undefined,
    addressLine: formData.get("addressLine") || undefined,
    city: formData.get("city") || undefined,
    state: formData.get("state") || undefined,
    country: formData.get("country") || undefined,
    status: formData.get("status") || PropertyClientStatus.PROSPECT,
    notes: formData.get("notes") || undefined,
    sendPortalInvite:
      formData.get("sendPortalInvite") === "on" || formData.get("sendPortalInvite") === "true",
  });
}

export function parseUpdatePropertyClientForm(formData: FormData) {
  return updatePropertyClientSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    alternatePhone: formData.get("alternatePhone") || undefined,
    addressLine: formData.get("addressLine") || undefined,
    city: formData.get("city") || undefined,
    state: formData.get("state") || undefined,
    country: formData.get("country") || undefined,
    status: formData.get("status") || PropertyClientStatus.ACTIVE,
    notes: formData.get("notes") || undefined,
  });
}

export const linkClientShortletSchema = z.object({
  shortletUnitId: z.string().trim().min(1, "Select an apartment."),
  role: z.nativeEnum(ClientUnitLinkRole).optional(),
  notes: z.string().trim().max(500).optional(),
});

export function parseLinkClientShortletForm(formData: FormData) {
  const roleRaw = formData.get("role");
  const roleValues = Object.values(ClientUnitLinkRole) as string[];
  const role =
    typeof roleRaw === "string" && roleValues.includes(roleRaw)
      ? (roleRaw as ClientUnitLinkRole)
      : ClientUnitLinkRole.TENANT;

  return linkClientShortletSchema.safeParse({
    shortletUnitId: formData.get("shortletUnitId"),
    role,
    notes: formData.get("notes") || undefined,
  });
}

export const recordClientDepositSchema = z.object({
  unitId: z.string().trim().min(1, "Select a project unit."),
  amount: z.coerce.number().positive("Payment amount must be greater than zero."),
  paidAt: z.string().trim().min(1, "Payment date is required."),
  method: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  reference: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
});

export function parseRecordClientDepositForm(formData: FormData) {
  return recordClientDepositSchema.safeParse({
    unitId: formData.get("unitId"),
    amount: formData.get("amount"),
    paidAt: formData.get("paidAt"),
    method: formData.get("method") || undefined,
    reference: formData.get("reference") || undefined,
    note: formData.get("note") || undefined,
  });
}

export function parseLinkClientUnitForm(formData: FormData) {
  const roleRaw = formData.get("role");
  const roleValues = Object.values(ClientUnitLinkRole) as string[];
  const role =
    typeof roleRaw === "string" && roleValues.includes(roleRaw)
      ? (roleRaw as ClientUnitLinkRole)
      : ClientUnitLinkRole.OWNER;

  return linkClientUnitSchema.safeParse({
    unitId: formData.get("unitId"),
    pricingPlanId: formData.get("pricingPlanId") || undefined,
    role,
    notes: formData.get("notes") || undefined,
  });
}
