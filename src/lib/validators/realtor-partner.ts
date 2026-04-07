import { z } from "zod";

export const createRealtorPartnerSchema = z.object({
  displayName: z.string().trim().min(2, "Display name is too short.").max(120, "Display name is too long."),
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined))
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email."),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined))
    .refine((v) => !v || v.length >= 7, "Phone number is too short."),
  company: z.string().trim().max(120, "Company is too long.").optional().transform((v) => (v && v !== "" ? v : undefined)),
  territory: z.string().trim().max(120, "Territory is too long.").optional().transform((v) => (v && v !== "" ? v : undefined)),
  notes: z.string().trim().max(4000, "Notes are too long.").optional().transform((v) => (v && v !== "" ? v : undefined)),
});

export function parseCreateRealtorPartnerForm(formData: FormData) {
  return createRealtorPartnerSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    company: formData.get("company"),
    territory: formData.get("territory"),
    notes: formData.get("notes"),
  });
}
