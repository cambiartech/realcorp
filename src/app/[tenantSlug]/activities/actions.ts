"use server";

import { auth } from "@/auth";
import { ActivityStatus, ActivityType, MembershipRole, MembershipStatus } from "@/generated/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import prisma from "@/lib/db";
import { touchLeadActivity } from "@/lib/lead-scoring";
import { canonicalPhone } from "@/lib/phone";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type ActionResult = { ok: true } | { ok: false; error: string };

const createActivitySchema = z.object({
  entityType: z.enum(["LEAD", "DEAL"]),
  entityId: z.string().trim().min(1),
  type: z.nativeEnum(ActivityType),
  title: z.string().trim().min(1, "Title is required.").max(200, "Title too long."),
  body: z.string().trim().max(2000).optional().transform((v) => (v && v !== "" ? v : undefined)),
  dueAt: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? new Date(v) : undefined))
    .refine((v) => !v || !isNaN(v.getTime()), "Invalid due date."),
  assignedUserId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "" ? v : undefined)),
});

async function resolveTenant(tenantSlug: string, userId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
  if (!tenant) return { tenant: null, membership: null };
  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId } },
    select: { status: true, role: true },
  });
  return { tenant, membership };
}

export async function createActivity(
  tenantSlug: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const raw = {
    entityType: formData.get("entityType"),
    entityId: formData.get("entityId"),
    type: formData.get("type"),
    title: formData.get("title"),
    body: formData.get("body") || undefined,
    dueAt: formData.get("dueAt") || undefined,
    assignedUserId: formData.get("assignedUserId") || undefined,
  };
  const parsed = createActivitySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
  }

  const { tenant, membership } = await resolveTenant(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!session.user.isPlatformAdmin && membership?.status !== MembershipStatus.ACTIVE) {
    return { ok: false, error: "You do not have permission to log activities." };
  }

  const isTask = parsed.data.type === ActivityType.TASK;
  const status =
    isTask && parsed.data.dueAt && parsed.data.dueAt > new Date()
      ? ActivityStatus.PENDING
      : isTask && parsed.data.dueAt && parsed.data.dueAt <= new Date()
        ? ActivityStatus.OVERDUE
        : ActivityStatus.DONE;

  try {
    await prisma.activity.create({
      data: {
        tenantId: tenant.id,
        entityType: parsed.data.entityType,
        entityId: parsed.data.entityId,
        type: parsed.data.type,
        status,
        title: parsed.data.title,
        body: parsed.data.body || null,
        dueAt: parsed.data.dueAt || null,
        createdByUserId: session.user.id,
        assignedUserId: parsed.data.assignedUserId || session.user.id,
        completedAt: status === ActivityStatus.DONE ? new Date() : null,
      },
    });
  } catch {
    return { ok: false, error: "Could not save activity." };
  }

  const entityPath =
    parsed.data.entityType === "LEAD"
      ? `/${tenantSlug}/leads/${parsed.data.entityId}`
      : `/${tenantSlug}/deals/${parsed.data.entityId}`;

  // Update lead score — if it's a deal activity, find the lead via the deal
  if (parsed.data.entityType === "LEAD") {
    void touchLeadActivity(parsed.data.entityId);
  } else {
    const deal = await prisma.deal.findFirst({
      where: { id: parsed.data.entityId },
      select: { leadId: true },
    });
    if (deal?.leadId) void touchLeadActivity(deal.leadId);
  }

  revalidatePath(entityPath);
  revalidatePath(`/${tenantSlug}/activities`);
  revalidatePath(`/${tenantSlug}/leads`);
  return { ok: true };
}

export async function deleteActivity(
  tenantSlug: string,
  activityId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, membership } = await resolveTenant(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!session.user.isPlatformAdmin && membership?.status !== MembershipStatus.ACTIVE) {
    return { ok: false, error: "You do not have permission." };
  }

  const activity = await prisma.activity.findFirst({
    where: { id: activityId, tenantId: tenant.id },
    select: { id: true, createdByUserId: true, entityType: true, entityId: true },
  });
  if (!activity) return { ok: false, error: "Activity not found." };

  const isOwner = activity.createdByUserId === session.user.id;
  const isManager =
    session.user.isPlatformAdmin ||
    membership?.role === MembershipRole.ORG_ADMIN ||
    membership?.role === MembershipRole.SALES_MANAGER;
  if (!isOwner && !isManager) {
    return { ok: false, error: "You can only delete your own activities." };
  }

  try {
    await prisma.activity.delete({ where: { id: activity.id } });
  } catch {
    return { ok: false, error: "Could not delete activity." };
  }

  const entityPath =
    activity.entityType === "LEAD"
      ? `/${tenantSlug}/leads/${activity.entityId}`
      : `/${tenantSlug}/deals/${activity.entityId}`;
  revalidatePath(entityPath);
  revalidatePath(`/${tenantSlug}/activities`);
  return { ok: true };
}

export async function completeActivity(
  tenantSlug: string,
  activityId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, membership } = await resolveTenant(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!session.user.isPlatformAdmin && membership?.status !== MembershipStatus.ACTIVE) {
    return { ok: false, error: "You do not have permission." };
  }

  const activity = await prisma.activity.findFirst({
    where: { id: activityId, tenantId: tenant.id },
    select: { id: true, entityType: true, entityId: true },
  });
  if (!activity) return { ok: false, error: "Activity not found." };

  try {
    await prisma.activity.update({
      where: { id: activity.id },
      data: { status: ActivityStatus.DONE, completedAt: new Date() },
    });
  } catch {
    return { ok: false, error: "Could not complete activity." };
  }

  const entityPath =
    activity.entityType === "LEAD"
      ? `/${tenantSlug}/leads/${activity.entityId}`
      : `/${tenantSlug}/deals/${activity.entityId}`;
  revalidatePath(entityPath);
  revalidatePath(`/${tenantSlug}/activities`);
  return { ok: true };
}

export async function getActivitiesForEntity(
  tenantSlug: string,
  entityType: "LEAD" | "DEAL",
  entityId: string,
) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const { tenant, membership } = await resolveTenant(tenantSlug, session.user.id);
  if (!tenant) return [];
  if (!session.user.isPlatformAdmin && membership?.status !== MembershipStatus.ACTIVE) return [];

  return prisma.activity.findMany({
    where: { tenantId: tenant.id, entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function replyWhatsApp(
  tenantSlug: string,
  leadId: string,
  toPhone: string,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const message = (formData.get("message") as string)?.trim();
  if (!message) return { ok: false, error: "Message is required." };

  const { tenant, membership } = await resolveTenant(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!session.user.isPlatformAdmin && membership?.status !== MembershipStatus.ACTIVE) {
    return { ok: false, error: "You do not have permission." };
  }

  const tenantWithSettings = await prisma.tenant.findUnique({
    where: { id: tenant.id },
    select: {
      id: true,
      settings: { select: { whatsappAccessToken: true, whatsappPhoneNumberId: true } },
    },
  });
  if (!tenantWithSettings?.settings?.whatsappAccessToken || !tenantWithSettings.settings.whatsappPhoneNumberId) {
    return { ok: false, error: "WhatsApp API is not configured." };
  }

  const targetPhone = canonicalPhone(toPhone);
  if (!targetPhone) return { ok: false, error: "Invalid recipient phone." };

  const sent = await sendWhatsAppText({
    phoneNumberId: tenantWithSettings.settings.whatsappPhoneNumberId,
    accessToken: tenantWithSettings.settings.whatsappAccessToken,
    to: targetPhone,
    body: message,
  });
  if (!sent.ok) return { ok: false, error: sent.error };

  await prisma.whatsAppMessage.create({
    data: {
      tenantId: tenant.id,
      leadId,
      direction: "OUTBOUND",
      waMessageId: sent.messageId || null,
      fromPhone: null,
      toPhone: targetPhone,
      body: message,
      timestamp: new Date(),
    },
  });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "SALES",
    entityType: "LEAD",
    entityId: leadId,
    action: "WHATSAPP_REPLY",
    summary: "Sent WhatsApp reply from omnichannel inbox.",
  });

  revalidatePath(`/${tenantSlug}/activities`);
  revalidatePath(`/${tenantSlug}/leads/${leadId}`);
  return { ok: true };
}
