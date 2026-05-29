import { LeadCaptureFormStatus } from "@/generated/prisma";
import { z } from "zod";
import { slugifyCaptureFormName } from "@/lib/capture-form-types";

const fieldSchema = z.object({
  key: z.string().min(1).max(64),
  type: z.enum([
    "name",
    "email",
    "phone",
    "text",
    "textarea",
    "select",
    "number",
    "project_interest",
    "budget_range",
  ]),
  label: z.string().min(1).max(120),
  required: z.boolean().optional(),
  placeholder: z.string().max(200).optional(),
  options: z.array(z.string().min(1).max(120)).optional(),
  halfWidth: z.boolean().optional(),
});

export const createCaptureFormSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only.")
    .optional(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional(),
  status: z.nativeEnum(LeadCaptureFormStatus).optional(),
  defaultSource: z.string().trim().max(120).optional(),
  campaignId: z.string().cuid().optional().or(z.literal("")),
  realtorPartnerId: z.string().cuid().optional().or(z.literal("")),
  thankYouMessage: z.string().trim().max(2000).optional(),
  redirectUrl: z.string().trim().url().optional().or(z.literal("")),
});

export function parseCreateCaptureForm(formData: FormData) {
  const name = String(formData.get("name") ?? "");
  const slugRaw = String(formData.get("slug") ?? "").trim();
  const parsed = createCaptureFormSchema.safeParse({
    name,
    slug: slugRaw || slugifyCaptureFormName(name),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    status: formData.get("status") || LeadCaptureFormStatus.DRAFT,
    defaultSource: formData.get("defaultSource") || undefined,
    campaignId: formData.get("campaignId") || undefined,
    realtorPartnerId: formData.get("realtorPartnerId") || undefined,
    thankYouMessage: formData.get("thankYouMessage") || undefined,
    redirectUrl: formData.get("redirectUrl") || undefined,
  });
  if (!parsed.success) {
    return { success: false as const, error: parsed.error };
  }
  return { success: true as const, data: parsed.data };
}

export function parseCaptureFormFieldsJson(raw: string) {
  try {
    const json = JSON.parse(raw) as unknown;
    return z.array(fieldSchema).min(1).max(20).safeParse(json);
  } catch {
    return { success: false as const, error: new z.ZodError([]) };
  }
}

export const captureFormEventSchema = z.object({
  sessionToken: z.string().min(8).max(128),
  type: z.enum(["VIEW", "START", "FIELD_BLUR", "PARTIAL_SAVE", "SUBMIT", "ABANDON"]),
  fieldKey: z.string().max(64).optional(),
  fieldValue: z.string().max(2000).optional(),
  partialPayload: z.record(z.string(), z.string()).optional(),
  attribution: z
    .object({
      utmSource: z.string().max(120).optional(),
      utmMedium: z.string().max(120).optional(),
      utmCampaign: z.string().max(120).optional(),
      utmContent: z.string().max(120).optional(),
      utmTerm: z.string().max(120).optional(),
      referrer: z.string().max(2000).optional(),
      landingUrl: z.string().max(2000).optional(),
      sharerUserId: z.string().max(64).optional(),
      realtorPartnerId: z.string().max(64).optional(),
    })
    .optional(),
  client: z
    .object({
      timezone: z.string().max(80).optional(),
      localHour: z.number().int().min(0).max(23).optional(),
      userAgent: z.string().max(2000).optional(),
    })
    .optional(),
});

export const captureFormSubmitSchema = z.object({
  sessionToken: z.string().min(8).max(128),
  values: z.record(z.string(), z.string()),
  attribution: captureFormEventSchema.shape.attribution,
  client: captureFormEventSchema.shape.client,
});
