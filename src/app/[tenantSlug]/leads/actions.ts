"use server";

import { auth } from "@/auth";
import { MembershipStatus } from "@/generated/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import prisma from "@/lib/db";
import { parseCreateLeadForm } from "@/lib/validators/lead";
import { recalculateLeadScore } from "@/lib/lead-scoring";
import { revalidatePath } from "next/cache";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function createLead(
  tenantSlug: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = parseCreateLeadForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((issue) => issue.message).join(" ") };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });
  if (!tenant) return { ok: false, error: "Tenant not found." };

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { status: true },
  });
  const canCreate = Boolean(session.user.isPlatformAdmin) || membership?.status === MembershipStatus.ACTIVE;
  if (!canCreate) return { ok: false, error: "You do not have permission to create leads." };

  if (parsed.data.assignedUserId) {
    const assigneeMembership = await prisma.membership.findFirst({
      where: {
        tenantId: tenant.id,
        userId: parsed.data.assignedUserId,
        status: MembershipStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (!assigneeMembership) {
      return { ok: false, error: "Assigned owner is invalid for this tenant." };
    }
  }

  let campaignId: string | null = null;
  let campaignName: string | null = parsed.data.campaignName || null;
  if (parsed.data.campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: parsed.data.campaignId, tenantId: tenant.id },
      select: { id: true, name: true },
    });
    if (!campaign) {
      return { ok: false, error: "Selected campaign is invalid." };
    }
    campaignId = campaign.id;
    if (!campaignName) campaignName = campaign.name;
  }

  try {
    const lead = await prisma.lead.create({
      data: {
        tenantId: tenant.id,
        assignedUserId: parsed.data.assignedUserId || null,
        source: parsed.data.source || null,
        campaignName,
        campaignId,
        projectInterest: parsed.data.projectInterest || null,
        budgetRange: parsed.data.budgetRange || null,
        quality: parsed.data.quality,
        name: parsed.data.name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
      },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "SALES",
      entityType: "LEAD",
      entityId: lead.id,
      action: "CREATE",
      summary: `Created lead ${lead.name || lead.email || lead.id}.`,
    });
    // Fire-and-forget score — don't block the response
    void recalculateLeadScore(lead.id);
  } catch {
    return { ok: false, error: "Could not create lead right now." };
  }

  revalidatePath(`/${tenantSlug}/leads`);
  return { ok: true };
}

export async function updateLead(
  tenantSlug: string,
  leadId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = parseCreateLeadForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });
  if (!tenant) return { ok: false, error: "Tenant not found." };

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { status: true },
  });
  if (!session.user.isPlatformAdmin && membership?.status !== MembershipStatus.ACTIVE) {
    return { ok: false, error: "You do not have permission to edit leads." };
  }

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tenantId: tenant.id },
    select: { id: true },
  });
  if (!lead) return { ok: false, error: "Lead not found." };

  if (parsed.data.assignedUserId) {
    const assignee = await prisma.membership.findFirst({
      where: { tenantId: tenant.id, userId: parsed.data.assignedUserId, status: MembershipStatus.ACTIVE },
      select: { id: true },
    });
    if (!assignee) return { ok: false, error: "Assigned owner is invalid for this tenant." };
  }

  let campaignId: string | null = null;
  let campaignName: string | null = parsed.data.campaignName || null;
  if (parsed.data.campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: parsed.data.campaignId, tenantId: tenant.id },
      select: { id: true, name: true },
    });
    if (!campaign) return { ok: false, error: "Selected campaign is invalid." };
    campaignId = campaign.id;
    if (!campaignName) campaignName = campaign.name;
  }

  try {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        name: parsed.data.name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        source: parsed.data.source || null,
        campaignName,
        campaignId,
        projectInterest: parsed.data.projectInterest || null,
        budgetRange: parsed.data.budgetRange || null,
        quality: parsed.data.quality,
        assignedUserId: parsed.data.assignedUserId || null,
      },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "SALES",
      entityType: "LEAD",
      entityId: lead.id,
      action: "UPDATE",
      summary: `Updated lead ${parsed.data.name || lead.id}.`,
    });
    void recalculateLeadScore(lead.id);
  } catch {
    return { ok: false, error: "Could not update lead right now." };
  }

  revalidatePath(`/${tenantSlug}/leads`);
  revalidatePath(`/${tenantSlug}/leads/${leadId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// CSV bulk import
// ---------------------------------------------------------------------------
export type ImportLeadRow = {
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  projectInterest?: string;
  budgetRange?: string;
  campaignName?: string;
};

export async function importLeads(
  tenantSlug: string,
  rows: ImportLeadRow[],
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  if (!rows.length) return { ok: false, error: "No rows to import." };
  if (rows.length > 1000) return { ok: false, error: "Maximum 1 000 rows per import." };

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });
  if (!tenant) return { ok: false, error: "Tenant not found." };

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { status: true },
  });
  if (!session.user.isPlatformAdmin && membership?.status !== MembershipStatus.ACTIVE) {
    return { ok: false, error: "You do not have permission to import leads." };
  }

  const now = new Date();
  const data = rows
    .filter((r) => r.name?.trim())
    .map((r) => ({
      tenantId: tenant.id,
      name: r.name.trim(),
      email: r.email?.trim() || null,
      phone: r.phone?.trim() || null,
      source: r.source?.trim() || null,
      projectInterest: r.projectInterest?.trim() || null,
      budgetRange: r.budgetRange?.trim() || null,
      campaignName: r.campaignName?.trim() || null,
      createdAt: now,
      updatedAt: now,
    }));

  if (!data.length) return { ok: false, error: "No valid rows found (name is required)." };

  const created = await prisma.lead.createMany({ data, skipDuplicates: false });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "SALES",
    entityType: "LEAD",
    entityId: tenant.id,
    action: "IMPORT",
    summary: `Bulk imported ${created.count} leads via CSV.`,
  });

  revalidatePath(`/${tenantSlug}/leads`);
  return { ok: true, count: created.count };
}

// ---------------------------------------------------------------------------
// SMS a lead via Termii
// ---------------------------------------------------------------------------
export async function sendSmsToLead(
  tenantSlug: string,
  leadId: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const message = (formData.get("message") as string)?.trim();
  if (!message) return { ok: false, error: "Message is required." };
  if (message.length > 640) return { ok: false, error: "Message too long (max 640 chars)." };

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      settings: { select: { termiiApiKey: true, termiiSenderId: true } },
    },
  });
  if (!tenant) return { ok: false, error: "Organization not found." };

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { status: true },
  });
  if (!session.user.isPlatformAdmin && membership?.status !== MembershipStatus.ACTIVE) {
    return { ok: false, error: "Permission denied." };
  }

  const apiKey = tenant.settings?.termiiApiKey;
  if (!apiKey) return { ok: false, error: "Termii API key not configured. Go to Settings → Integrations." };

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tenantId: tenant.id },
    select: { id: true, name: true, phone: true },
  });
  if (!lead) return { ok: false, error: "Lead not found." };
  if (!lead.phone) return { ok: false, error: "Lead has no phone number." };

  const { sendSms } = await import("@/lib/termii");
  const result = await sendSms(lead.phone, message, apiKey, tenant.settings?.termiiSenderId ?? "Realcorp");
  if (!result.ok) return { ok: false, error: result.error };

  // Log as an activity
  await prisma.activity.create({
    data: {
      tenantId: tenant.id,
      entityType: "LEAD",
      entityId: lead.id,
      type: "WHATSAPP", // reuse SMS type — we'll add SMS enum in a later sprint
      status: "DONE",
      title: `SMS sent to ${lead.name ?? lead.phone}`,
      body: message,
      createdByUserId: session.user.id,
    },
  });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "SALES",
    entityType: "LEAD",
    entityId: lead.id,
    action: "SMS_SENT",
    summary: `SMS sent to lead ${lead.name || lead.id}.`,
  });

  revalidatePath(`/${tenantSlug}/leads/${leadId}`);
  return { ok: true };
}

export async function sendWhatsAppToLead(
  tenantSlug: string,
  leadId: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const message = (formData.get("message") as string)?.trim();
  if (!message) return { ok: false, error: "Message is required." };

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      settings: { select: { whatsappAccessToken: true, whatsappPhoneNumberId: true, moduleWhatsApp: true } },
    },
  });
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (tenant.settings?.moduleWhatsApp === false) {
    return { ok: false, error: "WhatsApp is not enabled on your plan. Contact your platform admin." };
  }

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { status: true },
  });
  if (!session.user.isPlatformAdmin && membership?.status !== MembershipStatus.ACTIVE) {
    return { ok: false, error: "Permission denied." };
  }

  if (!tenant.settings?.whatsappAccessToken || !tenant.settings.whatsappPhoneNumberId) {
    return { ok: false, error: "WhatsApp API is not configured. Go to Settings → Integrations." };
  }

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, tenantId: tenant.id },
    select: { id: true, name: true, phone: true },
  });
  if (!lead) return { ok: false, error: "Lead not found." };
  if (!lead.phone) return { ok: false, error: "Lead has no phone number." };

  const { sendWhatsAppText, toWhatsAppPhone } = await import("@/lib/whatsapp");
  const to = toWhatsAppPhone(lead.phone);
  if (!to) return { ok: false, error: "Lead phone number is not a valid WhatsApp number." };

  const sent = await sendWhatsAppText({
    accessToken: tenant.settings.whatsappAccessToken,
    phoneNumberId: tenant.settings.whatsappPhoneNumberId,
    to,
    body: message,
  });
  if (!sent.ok) return { ok: false, error: sent.error };

  await prisma.whatsAppMessage.create({
    data: {
      tenantId: tenant.id,
      leadId: lead.id,
      direction: "OUTBOUND",
      waMessageId: sent.messageId || null,
      fromPhone: null,
      toPhone: to,
      body: message,
      timestamp: new Date(),
    },
  });

  await prisma.activity.create({
    data: {
      tenantId: tenant.id,
      entityType: "LEAD",
      entityId: lead.id,
      type: "WHATSAPP",
      status: "DONE",
      title: `WhatsApp sent to ${lead.name ?? lead.phone}`,
      body: message,
      createdByUserId: session.user.id,
    },
  });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "SALES",
    entityType: "LEAD",
    entityId: lead.id,
    action: "WHATSAPP_SENT",
    summary: `WhatsApp message sent to lead ${lead.name || lead.id}.`,
  });

  revalidatePath(`/${tenantSlug}/leads/${leadId}`);
  return { ok: true };
}
