"use server";

import prisma from "@/lib/db";
import { inboundLeadVisibilityData } from "@/lib/marketing-lead-routing";
import { z } from "zod";

const inquirySchema = z.object({
  projectId: z.string().trim().min(1),
  name: z.string().trim().min(2, "Enter your name.").max(120),
  phone: z.string().trim().min(7, "Enter a valid phone number.").max(32),
  email: z.string().trim().email("Enter a valid email.").max(200).optional().or(z.literal("")),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
  utmSource: z.string().trim().max(200).optional().or(z.literal("")),
  utmMedium: z.string().trim().max(200).optional().or(z.literal("")),
  utmCampaign: z.string().trim().max(200).optional().or(z.literal("")),
  utmContent: z.string().trim().max(200).optional().or(z.literal("")),
  utmTerm: z.string().trim().max(200).optional().or(z.literal("")),
});

/**
 * Public inquiry from the Explore page/widget. Creates a CRM lead attributed
 * to the listing the visitor was looking at.
 */
export async function submitExploreInquiry(
  tenantSlug: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = inquirySchema.safeParse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email") ?? "",
    message: formData.get("message") ?? "",
    utmSource: formData.get("utmSource") ?? "",
    utmMedium: formData.get("utmMedium") ?? "",
    utmCampaign: formData.get("utmCampaign") ?? "",
    utmContent: formData.get("utmContent") ?? "",
    utmTerm: formData.get("utmTerm") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, settings: { select: { marketingLeadRouting: true } } },
  });
  if (!tenant) return { ok: false, error: "Organization not found." };

  const project = await prisma.project.findFirst({
    where: { id: parsed.data.projectId, tenantId: tenant.id, isPublished: true },
    select: { id: true, name: true },
  });
  if (!project) return { ok: false, error: "This listing is no longer available." };

  // Light dedup: same phone inquiring about the same project within an hour
  // updates the note instead of creating a duplicate lead.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.lead.findFirst({
    where: {
      tenantId: tenant.id,
      phone: parsed.data.phone,
      projectInterest: project.name,
      createdAt: { gte: oneHourAgo },
    },
    select: { id: true },
  });
  if (recent) return { ok: true };

  await prisma.lead.create({
    data: {
      tenantId: tenant.id,
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      notes: parsed.data.message
        ? `Explore inquiry about ${project.name}: ${parsed.data.message}`
        : `Explore inquiry about ${project.name}.`,
      source: "Explore",
      projectInterest: project.name,
      utmSource: parsed.data.utmSource || null,
      utmMedium: parsed.data.utmMedium || null,
      utmCampaign: parsed.data.utmCampaign || null,
      utmContent: parsed.data.utmContent || null,
      utmTerm: parsed.data.utmTerm || null,
      lastActivityAt: new Date(),
      ...inboundLeadVisibilityData(tenant.settings?.marketingLeadRouting),
    },
  });

  return { ok: true };
}
