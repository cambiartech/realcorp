import { LeadQuality } from "@/generated/prisma";
import { z } from "zod";

export const createLeadSchema = z.object({
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
  source: z.string().trim().max(120, "Source is too long.").optional(),
  campaignName: z.string().trim().max(120, "Campaign name is too long.").optional(),
  projectInterest: z.string().trim().max(120, "Project interest is too long.").optional(),
  budgetRange: z.string().trim().max(120, "Budget range is too long.").optional(),
  quality: z.nativeEnum(LeadQuality).default(LeadQuality.WARM),
  assignedUserId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  campaignId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
});

export function parseCreateLeadForm(formData: FormData) {
  return createLeadSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    source: formData.get("source"),
    campaignName: formData.get("campaignName"),
    projectInterest: formData.get("projectInterest"),
    budgetRange: formData.get("budgetRange"),
    quality: formData.get("quality") || LeadQuality.WARM,
    assignedUserId: formData.get("assignedUserId"),
    campaignId: formData.get("campaignId"),
  });
}
