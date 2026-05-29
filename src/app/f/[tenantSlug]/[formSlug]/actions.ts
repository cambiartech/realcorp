"use server";

import {
  LeadCaptureFormEventType,
  LeadCaptureFormStatus,
  LeadCaptureSessionStatus,
} from "@/generated/prisma";
import { resolveCampaignFromUtm, parseDeviceFromUserAgent, parseGeoFromHeaders } from "@/lib/capture-form-attribution";
import { computeCompletionPct, parseCaptureFormFields } from "@/lib/capture-form-types";
import {
  buildLeadNotesFromCaptureValues,
  resolveLeadEmailFromValues,
  resolveLeadNameFromValues,
  resolveLeadPhoneFromValues,
} from "@/lib/capture-form-lead-map";
import prisma from "@/lib/db";
import { computeLeadScore, scoreToQuality } from "@/lib/lead-scoring";
import { captureFormEventSchema, captureFormSubmitSchema } from "@/lib/validators/capture-form";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

async function getTenantBySlug(tenantSlug: string) {
  return prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      slug: true,
      name: true,
      settings: { select: { logoUrl: true, primaryColor: true, accentColor: true } },
    },
  });
}

function captureFormServerError(err: unknown, context: string): string {
  console.error(`[${context}]`, err);
  if (process.env.NODE_ENV === "development" && err instanceof Error) {
    if (err.name === "PrismaClientValidationError" || err.message.includes("Unknown field")) {
      return "Server schema is out of date — restart the dev server (npm run dev) and try again.";
    }
  }
  return "Could not submit form. Try again shortly.";
}

export async function trackCaptureFormEvent(
  tenantSlug: string,
  formSlug: string,
  body: unknown,
): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> {
  const parsed = captureFormEventSchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: "Invalid event payload." };

  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return { ok: false, error: "Not found." };

  const form = await prisma.leadCaptureForm.findFirst({
    where: { tenantId: tenant.id, slug: formSlug, status: LeadCaptureFormStatus.ACTIVE },
    select: { id: true, fields: true },
  });
  if (!form) return { ok: false, error: "Form not found or inactive." };

  const hdrs = await headers();
  const geo = parseGeoFromHeaders(hdrs);
  const device = parseDeviceFromUserAgent(parsed.data.client?.userAgent);
  const attr = parsed.data.attribution ?? {};
  const fields = parseCaptureFormFields(form.fields);
  const partial = parsed.data.partialPayload ?? {};
  const completionPct = computeCompletionPct(fields, partial);

  let sessionRow = await prisma.leadCaptureFormSession.findUnique({
    where: { formId_sessionToken: { formId: form.id, sessionToken: parsed.data.sessionToken } },
  });

  if (!sessionRow) {
    sessionRow = await prisma.leadCaptureFormSession.create({
      data: {
        tenantId: tenant.id,
        formId: form.id,
        sessionToken: parsed.data.sessionToken,
        status: LeadCaptureSessionStatus.VIEWED,
        utmSource: attr.utmSource ?? null,
        utmMedium: attr.utmMedium ?? null,
        utmCampaign: attr.utmCampaign ?? null,
        utmContent: attr.utmContent ?? null,
        utmTerm: attr.utmTerm ?? null,
        referrer: attr.referrer ?? null,
        landingUrl: attr.landingUrl ?? null,
        sharerUserId: attr.sharerUserId ?? null,
        realtorPartnerId: attr.realtorPartnerId ?? null,
        ipCountry: geo.ipCountry ?? null,
        ipRegion: geo.ipRegion ?? null,
        ipCity: geo.ipCity ?? null,
        timezone: parsed.data.client?.timezone ?? null,
        localHour: parsed.data.client?.localHour ?? null,
        deviceType: device.deviceType,
        browser: device.browser,
        os: device.os,
        userAgent: parsed.data.client?.userAgent ?? null,
      },
    });
  }

  const eventType = parsed.data.type as LeadCaptureFormEventType;
  let nextStatus = sessionRow.status;
  const updates: Record<string, unknown> = {
    lastActivityAt: new Date(),
    utmSource: sessionRow.utmSource ?? attr.utmSource ?? null,
    utmMedium: sessionRow.utmMedium ?? attr.utmMedium ?? null,
    utmCampaign: sessionRow.utmCampaign ?? attr.utmCampaign ?? null,
    utmContent: sessionRow.utmContent ?? attr.utmContent ?? null,
    utmTerm: sessionRow.utmTerm ?? attr.utmTerm ?? null,
    sharerUserId: sessionRow.sharerUserId ?? attr.sharerUserId ?? null,
    realtorPartnerId: sessionRow.realtorPartnerId ?? attr.realtorPartnerId ?? null,
  };

  if (eventType === "VIEW") {
    await prisma.leadCaptureForm.update({ where: { id: form.id }, data: { viewCount: { increment: 1 } } });
  }
  if (eventType === "START") {
    nextStatus = LeadCaptureSessionStatus.STARTED;
    updates.startedAt = sessionRow.startedAt ?? new Date();
    await prisma.leadCaptureForm.update({ where: { id: form.id }, data: { startCount: { increment: 1 } } });
  }
  if (eventType === "FIELD_BLUR" || eventType === "PARTIAL_SAVE") {
    nextStatus =
      completionPct >= 100
        ? LeadCaptureSessionStatus.PARTIAL
        : completionPct > 0
          ? LeadCaptureSessionStatus.PARTIAL
          : sessionRow.status;
    updates.fieldsCompleted = partial;
    updates.completionPct = completionPct;
    updates.lastFieldKey = parsed.data.fieldKey ?? sessionRow.lastFieldKey;
  }
  if (eventType === "ABANDON" && sessionRow.status !== LeadCaptureSessionStatus.COMPLETED) {
    nextStatus = LeadCaptureSessionStatus.ABANDONED;
    updates.fieldsCompleted = partial;
    updates.completionPct = completionPct;
    updates.lastFieldKey = parsed.data.fieldKey ?? sessionRow.lastFieldKey;
  }

  updates.status = nextStatus;

  await prisma.$transaction([
    prisma.leadCaptureFormSession.update({ where: { id: sessionRow.id }, data: updates }),
    prisma.leadCaptureFormEvent.create({
      data: {
        tenantId: tenant.id,
        formId: form.id,
        sessionId: sessionRow.id,
        type: eventType,
        fieldKey: parsed.data.fieldKey ?? null,
        payload: parsed.data.fieldValue ? { value: parsed.data.fieldValue } : partial,
      },
    }),
  ]);

  return { ok: true, sessionId: sessionRow.id };
}

export async function submitCaptureForm(
  tenantSlug: string,
  formSlug: string,
  body: unknown,
): Promise<{ ok: true; leadId: string; redirectUrl?: string | null } | { ok: false; error: string }> {
  try {
    const parsed = captureFormSubmitSchema.safeParse(body);
    if (!parsed.success) return { ok: false, error: "Please check the form and try again." };

    const tenant = await getTenantBySlug(tenantSlug);
    if (!tenant) return { ok: false, error: "Not found." };

    const form = await prisma.leadCaptureForm.findFirst({
      where: { tenantId: tenant.id, slug: formSlug, status: LeadCaptureFormStatus.ACTIVE },
      select: {
        id: true,
        name: true,
        title: true,
        fields: true,
        defaultSource: true,
        campaignId: true,
        assignedUserId: true,
        realtorPartnerId: true,
        redirectUrl: true,
        autoWhatsAppEnabled: true,
        autoWhatsAppMessage: true,
        campaign: { select: { name: true } },
      },
    });
    if (!form) return { ok: false, error: "Form not found or inactive." };

    const fields = parseCaptureFormFields(form.fields);
    for (const field of fields) {
      if (field.required && !(parsed.data.values[field.key] ?? "").trim()) {
        return { ok: false, error: `${field.label} is required.` };
      }
    }

    const name = resolveLeadNameFromValues(fields, parsed.data.values);
    if (!name) return { ok: false, error: "Name is required." };

    const email = resolveLeadEmailFromValues(fields, parsed.data.values);
    const phone = resolveLeadPhoneFromValues(fields, parsed.data.values);
    const notes = buildLeadNotesFromCaptureValues(fields, parsed.data.values);

    const attr = parsed.data.attribution ?? {};
    const { campaignId: resolvedCampaignId, campaignName: resolvedCampaignName } = await resolveCampaignFromUtm(
      tenant.id,
      attr.utmCampaign,
    );
    const campaignId = form.campaignId ?? resolvedCampaignId;
    const campaignName = form.campaign?.name ?? resolvedCampaignName;

    let realtorPartnerId = form.realtorPartnerId ?? attr.realtorPartnerId ?? null;
    if (attr.realtorPartnerId) {
      const partner = await prisma.realtorPartner.findFirst({
        where: { id: attr.realtorPartnerId, tenantId: tenant.id, isActive: true },
        select: { id: true, displayName: true },
      });
      if (partner) realtorPartnerId = partner.id;
    }

    const sourceParts = [form.defaultSource ?? "Lead Form", form.title].filter(Boolean);
    const source = sourceParts.join(": ");

    const scoreBreakdown = computeLeadScore({
      source,
      email,
      phone,
      projectInterest: parsed.data.values.project_interest ?? null,
      budgetRange: parsed.data.values.budget_range ?? null,
      lastActivityAt: new Date(),
      bestDealStage: null,
    });
    const score = scoreBreakdown.total;
    const quality = scoreToQuality(score);

    const hdrs = await headers();
    const geo = parseGeoFromHeaders(hdrs);
    const device = parseDeviceFromUserAgent(parsed.data.client?.userAgent);

    let sessionRow = await prisma.leadCaptureFormSession.findUnique({
      where: { formId_sessionToken: { formId: form.id, sessionToken: parsed.data.sessionToken } },
    });

    if (!sessionRow) {
      sessionRow = await prisma.leadCaptureFormSession.create({
        data: {
          tenantId: tenant.id,
          formId: form.id,
          sessionToken: parsed.data.sessionToken,
          status: LeadCaptureSessionStatus.STARTED,
          startedAt: new Date(),
          utmSource: attr.utmSource ?? null,
          utmMedium: attr.utmMedium ?? null,
          utmCampaign: attr.utmCampaign ?? null,
          utmContent: attr.utmContent ?? null,
          utmTerm: attr.utmTerm ?? null,
          referrer: attr.referrer ?? null,
          landingUrl: attr.landingUrl ?? null,
          sharerUserId: attr.sharerUserId ?? null,
          realtorPartnerId,
          ipCountry: geo.ipCountry ?? null,
          ipRegion: geo.ipRegion ?? null,
          ipCity: geo.ipCity ?? null,
          timezone: parsed.data.client?.timezone ?? null,
          localHour: parsed.data.client?.localHour ?? null,
          deviceType: device.deviceType,
          browser: device.browser,
          os: device.os,
          userAgent: parsed.data.client?.userAgent ?? null,
        },
      });
    }

    const assignedUserId = attr.sharerUserId ?? form.assignedUserId ?? null;

    const lead = await prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          tenantId: tenant.id,
          name,
          email: email || null,
          phone: phone || null,
          notes,
          source,
          campaignId,
          campaignName,
          utmSource: attr.utmSource ?? null,
          utmMedium: attr.utmMedium ?? null,
          utmCampaign: attr.utmCampaign ?? null,
          utmContent: attr.utmContent ?? null,
          utmTerm: attr.utmTerm ?? null,
          realtorPartnerId,
          assignedUserId,
          projectInterest: parsed.data.values.project_interest?.trim() || null,
          budgetRange: parsed.data.values.budget_range?.trim() || null,
          quality,
          score,
          lastActivityAt: new Date(),
        },
      });

      await tx.leadCaptureFormSession.update({
        where: { id: sessionRow!.id },
        data: {
          status: LeadCaptureSessionStatus.COMPLETED,
          completedAt: new Date(),
          leadId: created.id,
          fieldsCompleted: parsed.data.values,
          completionPct: 100,
          lastActivityAt: new Date(),
        },
      });

      await tx.leadCaptureFormEvent.create({
        data: {
          tenantId: tenant.id,
          formId: form.id,
          sessionId: sessionRow!.id,
          type: LeadCaptureFormEventType.SUBMIT,
          payload: parsed.data.values,
        },
      });

      await tx.leadCaptureForm.update({
        where: { id: form.id },
        data: { submitCount: { increment: 1 } },
      });

      return created;
    });

    revalidatePath(`/${tenantSlug}/leads`);
    revalidatePath(`/${tenantSlug}/marketing`);

    const leadPhone = resolveLeadPhoneFromValues(fields, parsed.data.values);
    if (form.autoWhatsAppEnabled && leadPhone) {
      const { renderCaptureFormWhatsAppMessage, sendCaptureFormAutoWhatsApp } = await import(
        "@/lib/capture-form-whatsapp"
      );
      const message = renderCaptureFormWhatsAppMessage(form.autoWhatsAppMessage, {
        name: name ?? "there",
        formTitle: form.title,
        tenantName: tenant.name,
      });
      void sendCaptureFormAutoWhatsApp({
        tenantId: tenant.id,
        leadId: lead.id,
        phone: leadPhone,
        message,
      });
    }

    return { ok: true, leadId: lead.id, redirectUrl: form.redirectUrl };
  } catch (err) {
    return { ok: false, error: captureFormServerError(err, "submitCaptureForm") };
  }
}
