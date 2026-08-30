"use server";

import { auth } from "@/auth";
import { MarketingLeadRouting, MembershipStatus } from "@/generated/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import { canEditMarketing } from "@/lib/marketing-access";
import prisma from "@/lib/db";
import { parseCreateCampaignForm } from "@/lib/validators/campaign";
import { revalidatePath } from "next/cache";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function createCampaign(
  tenantSlug: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = parseCreateCampaignForm(formData);
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
    select: { status: true, role: true },
  });
  if (!canEditMarketing(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to manage campaigns." };
  }

  try {
    const campaign = await prisma.campaign.create({
      data: {
        tenantId: tenant.id,
        name: parsed.data.name,
        code: parsed.data.code,
        description: parsed.data.description ?? null,
        status: parsed.data.status,
      },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "MARKETING",
      entityType: "CAMPAIGN",
      entityId: campaign.id,
      action: "CREATE",
      summary: `Created campaign ${campaign.name} (${campaign.code}).`,
    });
  } catch (e: unknown) {
    const msg = e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002";
    if (msg) return { ok: false, error: "A campaign with this code already exists for this workspace." };
    return { ok: false, error: "Could not create campaign." };
  }

  revalidatePath(`/${tenantSlug}/marketing`);
  return { ok: true };
}

function revalidateMarketingFunnel(tenantSlug: string) {
  revalidatePath(`/${tenantSlug}/marketing`);
  revalidatePath(`/${tenantSlug}/marketing/entries`);
  revalidatePath(`/${tenantSlug}/marketing/settings`);
  revalidatePath(`/${tenantSlug}/leads`);
}

async function requireMarketingEditor(tenantSlug: string, userId: string, isPlatformAdmin: boolean) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });
  if (!tenant) return { tenant: null as null, error: "Organization not found." };
  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId } },
    select: { status: true, role: true },
  });
  if (!canEditMarketing(isPlatformAdmin, membership)) {
    return { tenant: null, error: "You do not have permission to change marketing settings." };
  }
  return { tenant, error: null };
}

export async function saveMarketingLeadRouting(
  tenantSlug: string,
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const routing = String(formData.get("marketingLeadRouting") || "");
  if (routing !== MarketingLeadRouting.SALES_IMMEDIATE && routing !== MarketingLeadRouting.MARKETING_HOLD) {
    return { ok: false, error: "Choose how marketing submissions should reach Sales." };
  }
  const { tenant, error } = await requireMarketingEditor(
    tenantSlug,
    session.user.id,
    Boolean(session.user.isPlatformAdmin),
  );
  if (!tenant) return { ok: false, error };

  await prisma.tenantSettings.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id, marketingLeadRouting: routing },
    update: { marketingLeadRouting: routing },
  });
  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email,
    module: "MARKETING",
    entityType: "TENANT_SETTINGS",
    action: "UPDATE",
    summary:
      routing === MarketingLeadRouting.MARKETING_HOLD
        ? "Marketing submissions now wait in Entries until pushed to Sales."
        : "Marketing submissions now appear on Sales Leads immediately.",
  });
  revalidateMarketingFunnel(tenantSlug);
  return { ok: true };
}

export async function assignMarketingEntry(
  tenantSlug: string,
  leadId: string,
  assignedUserId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const { tenant, error } = await requireMarketingEditor(
    tenantSlug,
    session.user.id,
    Boolean(session.user.isPlatformAdmin),
  );
  if (!tenant) return { ok: false, error };

  const ownerId = assignedUserId.trim();
  if (ownerId) {
    const member = await prisma.membership.findFirst({
      where: { tenantId: tenant.id, userId: ownerId, status: MembershipStatus.ACTIVE },
      select: { id: true },
    });
    if (!member) return { ok: false, error: "Choose an active team member." };
  }

  const updated = await prisma.lead.updateMany({
    where: { id: leadId, tenantId: tenant.id, salesVisible: false },
    data: { assignedUserId: ownerId || null },
  });
  if (!updated.count) return { ok: false, error: "That entry is no longer waiting in Marketing." };
  revalidatePath(`/${tenantSlug}/marketing/entries`);
  return { ok: true };
}

export async function pushMarketingEntryToSales(
  tenantSlug: string,
  leadId: string,
  assignedUserId?: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const { tenant, error } = await requireMarketingEditor(
    tenantSlug,
    session.user.id,
    Boolean(session.user.isPlatformAdmin),
  );
  if (!tenant) return { ok: false, error };

  const ownerId = assignedUserId?.trim() || undefined;
  if (ownerId) {
    const member = await prisma.membership.findFirst({
      where: { tenantId: tenant.id, userId: ownerId, status: MembershipStatus.ACTIVE },
      select: { id: true },
    });
    if (!member) return { ok: false, error: "Choose an active team member." };
  }

  const updated = await prisma.lead.updateMany({
    where: { id: leadId, tenantId: tenant.id, salesVisible: false },
    data: {
      salesVisible: true,
      salesReleasedAt: new Date(),
      ...(ownerId ? { assignedUserId: ownerId } : {}),
    },
  });
  if (!updated.count) return { ok: false, error: "That entry is no longer waiting in Marketing." };
  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email,
    module: "MARKETING",
    entityType: "LEAD",
    entityId: leadId,
    action: "UPDATE",
    summary: "Pushed a marketing entry to Sales Leads.",
  });
  revalidateMarketingFunnel(tenantSlug);
  return { ok: true };
}

export async function pushAllMarketingEntriesToSales(tenantSlug: string): Promise<ActionResult & { count?: number }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const { tenant, error } = await requireMarketingEditor(
    tenantSlug,
    session.user.id,
    Boolean(session.user.isPlatformAdmin),
  );
  if (!tenant) return { ok: false, error };

  const updated = await prisma.lead.updateMany({
    where: { tenantId: tenant.id, salesVisible: false },
    data: { salesVisible: true, salesReleasedAt: new Date() },
  });
  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email,
    module: "MARKETING",
    entityType: "LEAD",
    action: "UPDATE",
    summary: `Pushed ${updated.count} marketing ${updated.count === 1 ? "entry" : "entries"} to Sales Leads.`,
  });
  revalidateMarketingFunnel(tenantSlug);
  return { ok: true, count: updated.count };
}
