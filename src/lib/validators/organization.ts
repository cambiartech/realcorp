import { z } from "zod";

export const organizationOnboardingSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters.")
    .max(120, "Organization name is too long."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers, and single hyphens only (e.g. bo-properties).",
    ),
  adminEmail: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Org admin email is required.")
    .email("Enter a valid email address."),
  adminName: z.string().trim().max(80, "Name is too long.").optional(),
  plan: z.enum(["STARTER", "GROWTH", "ENTERPRISE", "ANCHOR"]).optional(),
});

export type OnboardingFieldName = "organizationName" | "slug" | "adminEmail" | "adminName" | "plan";

export function onboardingInputFromFormData(formData: FormData) {
  const adminRaw = formData.get("adminName");
  const adminNameRaw = typeof adminRaw === "string" ? adminRaw.trim() : "";
  const planRaw = formData.get("plan");
  return {
    organizationName: formData.get("organizationName"),
    slug: formData.get("slug"),
    adminEmail: formData.get("adminEmail"),
    adminName: adminNameRaw === "" ? undefined : adminNameRaw,
    plan: typeof planRaw === "string" && planRaw !== "" ? planRaw : undefined,
  };
}

export function parseOrganizationOnboardingForm(formData: FormData) {
  return organizationOnboardingSchema.safeParse(onboardingInputFromFormData(formData));
}

export function zodOnboardingIssuesToFieldRecord(
  issues: z.ZodIssue[],
): Partial<Record<OnboardingFieldName, string>> {
  const out: Partial<Record<OnboardingFieldName, string>> = {};
  for (const issue of issues) {
    const key = issue.path[0] as OnboardingFieldName;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
