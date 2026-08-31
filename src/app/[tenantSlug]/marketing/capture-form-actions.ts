"use server";

import { auth } from "@/auth";
import { submitCaptureForm } from "@/app/f/[tenantSlug]/[formSlug]/actions";
import { LeadCaptureFormStatus, MarketingLeadRouting } from "@/generated/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import { slugifyCaptureFormName } from "@/lib/capture-form-types";
import { resolveCaptureFormTemplate } from "@/lib/capture-form-templates";
import { canEditMarketing } from "@/lib/marketing-access";
import { sanitizeRichTextHtml } from "@/lib/rich-text-sanitize";
import prisma from "@/lib/db";
import { parseCreateCaptureForm, parseCaptureFormFieldsJson } from "@/lib/validators/capture-form";
import { revalidatePath } from "next/cache";
import type { CaptureFormField } from "@/lib/capture-form-types";

export type CaptureFormActionResult = { ok: true; id?: string } | { ok: false; error: string };
export type ManualFillResult =
  | { ok: true; leadId: string; heldForMarketing: boolean }
  | { ok: false; error: string };

type CaptureFormEditorAccess =
  | {
      ok: true;
      userId: string;
      actorLabel: string;
      tenant: {
        id: string;
        settings: { marketingLeadRouting: MarketingLeadRouting } | null;
      };
    }
  | { ok: false; error: string };

async function requireCaptureFormEditor(tenantSlug: string): Promise<CaptureFormEditorAccess> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, settings: { select: { marketingLeadRouting: true } } },
  });
  if (!tenant) return { ok: false, error: "Organization not found." };
  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true, status: true },
  });
  if (!canEditMarketing(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to manage capture forms." };
  }
  return {
    ok: true,
    userId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    tenant,
  };
}

export async function createLeadCaptureForm(
  tenantSlug: string,
  _prev: CaptureFormActionResult | null,
  formData: FormData,
): Promise<CaptureFormActionResult> {
  const parsed = parseCreateCaptureForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
  }

  const access = await requireCaptureFormEditor(tenantSlug);
  if (!access.ok) return { ok: false, error: access.error };
  const { userId, actorLabel, tenant } = access;

  const slug = parsed.data.slug ?? slugifyCaptureFormName(parsed.data.name);
  const existing = await prisma.leadCaptureForm.findUnique({
    where: { tenantId_slug: { tenantId: tenant.id, slug } },
    select: { id: true },
  });
  if (existing) return { ok: false, error: "That URL slug is already in use. Pick another." };

  const templateId = String(formData.get("fieldsTemplate") || "lead_magnet");
  let fields = resolveCaptureFormTemplate(templateId);
  const fieldsRaw = String(formData.get("fields") ?? "").trim();
  if (fieldsRaw) {
    const fieldsParsed = parseCaptureFormFieldsJson(fieldsRaw);
    if (fieldsParsed.success) {
      if (fieldsParsed.data.length === 0 && templateId === "blank") {
        return { ok: false, error: "Add at least one field to your form." };
      }
      if (fieldsParsed.data.length > 0) fields = fieldsParsed.data;
    }
  }
  if (!fields.length) {
    return { ok: false, error: "Add at least one field to your form." };
  }

  try {
    const form = await prisma.leadCaptureForm.create({
      data: {
        tenantId: tenant.id,
        name: parsed.data.name,
        slug,
        title: parsed.data.title,
        description: parsed.data.description ? sanitizeRichTextHtml(parsed.data.description) : null,
        status: parsed.data.status ?? LeadCaptureFormStatus.DRAFT,
        fields,
        defaultSource: parsed.data.defaultSource ?? "Lead Form",
        campaignId: parsed.data.campaignId || null,
        realtorPartnerId: parsed.data.realtorPartnerId || null,
        thankYouMessage: parsed.data.thankYouMessage ?? "Thanks — we'll be in touch shortly.",
        redirectUrl: parsed.data.redirectUrl || null,
        createdByUserId: userId,
      },
    });

    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: userId,
      actorLabel,
      module: "MARKETING",
      entityType: "LEAD_CAPTURE_FORM",
      entityId: form.id,
      action: "CREATE",
      summary: `Created capture form "${form.name}"`,
    });

    revalidatePath(`/${tenantSlug}/marketing`);
    return { ok: true, id: form.id };
  } catch {
    return { ok: false, error: "Could not create capture form." };
  }
}

export async function updateLeadCaptureFormStatus(
  tenantSlug: string,
  formId: string,
  status: LeadCaptureFormStatus,
): Promise<CaptureFormActionResult> {
  const access = await requireCaptureFormEditor(tenantSlug);
  if (!access.ok) return { ok: false, error: access.error };

  await prisma.leadCaptureForm.updateMany({
    where: { id: formId, tenantId: access.tenant.id },
    data: { status },
  });
  revalidatePath(`/${tenantSlug}/marketing`);
  revalidatePath(`/${tenantSlug}/marketing/forms/${formId}`);
  return { ok: true };
}

export async function updateLeadCaptureFormSettings(
  tenantSlug: string,
  formId: string,
  _prev: CaptureFormActionResult | null,
  formData: FormData,
): Promise<CaptureFormActionResult> {
  const access = await requireCaptureFormEditor(tenantSlug);
  if (!access.ok) return { ok: false, error: access.error };

  const title = String(formData.get("title") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!title || !name) return { ok: false, error: "Name and title are required." };

  await prisma.leadCaptureForm.updateMany({
    where: { id: formId, tenantId: access.tenant.id },
    data: {
      name,
      title,
      description: (() => {
        const raw = String(formData.get("description") ?? "").trim();
        return raw ? sanitizeRichTextHtml(raw) : null;
      })(),
      thankYouMessage: String(formData.get("thankYouMessage") ?? "").trim() || null,
      redirectUrl: String(formData.get("redirectUrl") ?? "").trim() || null,
      defaultSource: String(formData.get("defaultSource") ?? "").trim() || "Lead Form",
      campaignId: String(formData.get("campaignId") ?? "") || null,
      realtorPartnerId: String(formData.get("realtorPartnerId") ?? "") || null,
      autoWhatsAppEnabled: formData.get("autoWhatsAppEnabled") === "on",
      autoWhatsAppMessage: String(formData.get("autoWhatsAppMessage") ?? "").trim() || null,
    },
  });

  revalidatePath(`/${tenantSlug}/marketing/forms/${formId}`);
  revalidatePath(`/${tenantSlug}/marketing`);
  return { ok: true };
}

export async function updateLeadCaptureFormFields(
  tenantSlug: string,
  formId: string,
  fields: CaptureFormField[],
): Promise<CaptureFormActionResult> {
  const access = await requireCaptureFormEditor(tenantSlug);
  if (!access.ok) return { ok: false, error: access.error };

  const parsed = parseCaptureFormFieldsJson(JSON.stringify(fields));
  if (!parsed.success) {
    return { ok: false, error: "Invalid field configuration." };
  }

  await prisma.leadCaptureForm.updateMany({
    where: { id: formId, tenantId: access.tenant.id },
    data: { fields: parsed.data },
  });

  revalidatePath(`/${tenantSlug}/marketing/forms/${formId}`);
  return { ok: true };
}

export async function submitManualCaptureForm(
  tenantSlug: string,
  formSlug: string,
  values: Record<string, string>,
  client?: { timezone?: string; localHour?: number },
): Promise<ManualFillResult> {
  const access = await requireCaptureFormEditor(tenantSlug);
  if (!access.ok) return { ok: false, error: access.error };
  const { userId, actorLabel, tenant } = access;

  const form = await prisma.leadCaptureForm.findFirst({
    where: { tenantId: tenant.id, slug: formSlug },
    select: { id: true, name: true, status: true },
  });
  if (!form) return { ok: false, error: "Form not found." };
  if (form.status !== LeadCaptureFormStatus.ACTIVE) {
    return { ok: false, error: "Activate this form first, then you can fill it for someone." };
  }

  const result = await submitCaptureForm(tenantSlug, formSlug, {
    sessionToken: `staff-${userId}-${crypto.randomUUID()}`.slice(0, 128),
    values,
    attribution: {
      utmSource: "staff",
      utmMedium: "manual",
      utmCampaign: formSlug,
      sharerUserId: userId,
    },
    client: {
      timezone: client?.timezone,
      localHour: client?.localHour,
    },
  });
  if (!result.ok) return { ok: false, error: result.error };

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: userId,
    actorLabel,
    module: "MARKETING",
    entityType: "LEAD",
    entityId: result.leadId,
    action: "CREATE",
    summary: `Filled capture form "${form.name}" for someone`,
  });

  return {
    ok: true,
    leadId: result.leadId,
    heldForMarketing: tenant.settings?.marketingLeadRouting === MarketingLeadRouting.MARKETING_HOLD,
  };
}
