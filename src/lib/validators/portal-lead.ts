import { LeadQuality } from "@/generated/prisma";
import { z } from "zod";

export const portalLeadSchema = z.object({
  name: z.string().trim().min(2, "Lead name must be at least 2 characters.").max(120, "Lead name is too long."),
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined))
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email address."),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined))
    .refine((v) => !v || v.length >= 7, "Phone number is too short."),
  projectInterest: z.string().trim().max(120, "Project interest is too long.").optional().transform((v) => (v && v !== "" ? v : undefined)),
  budgetRange: z.string().trim().max(120, "Budget range is too long.").optional().transform((v) => (v && v !== "" ? v : undefined)),
  quality: z.nativeEnum(LeadQuality).default(LeadQuality.WARM),
  utmSource: z.string().trim().max(120).optional().transform((v) => (v && v !== "" ? v : undefined)),
  utmMedium: z.string().trim().max(120).optional().transform((v) => (v && v !== "" ? v : undefined)),
  utmCampaign: z.string().trim().max(120).optional().transform((v) => (v && v !== "" ? v : undefined)),
});

export function parsePortalLeadForm(formData: FormData) {
  return portalLeadSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    projectInterest: formData.get("projectInterest"),
    budgetRange: formData.get("budgetRange"),
    quality: formData.get("quality") || LeadQuality.WARM,
    utmSource: formData.get("utmSource"),
    utmMedium: formData.get("utmMedium"),
    utmCampaign: formData.get("utmCampaign"),
  });
}
