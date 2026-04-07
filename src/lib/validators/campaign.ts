import { CampaignStatus } from "@/generated/prisma";
import { z } from "zod";

const codePattern = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

export const createCampaignSchema = z.object({
  name: z.string().trim().min(2, "Name is too short.").max(120, "Name is too long."),
  code: z
    .string()
    .trim()
    .max(64, "Code is too long.")
    .transform((v) => v.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, ""))
    .refine((v) => v.length >= 3, "Code must be at least 3 characters.")
    .refine((v) => codePattern.test(v), "Use lowercase letters, numbers, and hyphens (e.g. spring-launch-2026)."),
  description: z
    .string()
    .trim()
    .max(2000, "Description is too long.")
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
  status: z.nativeEnum(CampaignStatus).default(CampaignStatus.ACTIVE),
});

export function parseCreateCampaignForm(formData: FormData) {
  return createCampaignSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    description: formData.get("description"),
    status: formData.get("status") || CampaignStatus.ACTIVE,
  });
}
