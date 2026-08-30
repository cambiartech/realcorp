"use server";

import { auth } from "@/auth";
import { DealStage, MembershipStatus, UnitStatus } from "@/generated/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import prisma from "@/lib/db";
import { recalculateLeadScore } from "@/lib/lead-scoring";
import { parseCreateDealForm, parseMoveDealStageForm } from "@/lib/validators/deal";
import { revalidatePath } from "next/cache";

type ActionResult = { ok: true } | { ok: false; error: string };

async function getTenantAndMembership(tenantSlug: string, userId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });
  if (!tenant) return { tenant: null, isActiveMember: false };

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId } },
    select: { status: true },
  });
  return { tenant, isActiveMember: membership?.status === MembershipStatus.ACTIVE };
}

export async function createDeal(
  tenantSlug: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = parseCreateDealForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
  }

  const { tenant, isActiveMember } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!(session.user.isPlatformAdmin || isActiveMember)) {
    return { ok: false, error: "You do not have permission to create deals." };
  }

  if (parsed.data.leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: parsed.data.leadId, tenantId: tenant.id, salesVisible: true },
      select: { id: true },
    });
    if (!lead) return { ok: false, error: "Selected lead is invalid." };
  }

  if (parsed.data.unitId) {
    const unit = await prisma.unit.findFirst({
      where: { id: parsed.data.unitId, tenantId: tenant.id },
      select: { id: true, status: true, deal: { select: { id: true } } },
    });
    if (!unit) return { ok: false, error: "Selected unit is invalid." };
    if (unit.deal?.id) return { ok: false, error: "Selected unit is already linked to another deal." };
    if (parsed.data.stage === DealStage.RESERVATION_MADE && unit.status !== UnitStatus.RESERVED) {
      return { ok: false, error: "Unit must be reserved before setting reservation stage." };
    }
  }

  try {
    const created = await prisma.deal.create({
      data: {
        tenantId: tenant.id,
        leadId: parsed.data.leadId || null,
        unitId: parsed.data.unitId || null,
        assignedUserId: parsed.data.assignedUserId || session.user.id,
        value: parsed.data.value ? Number(parsed.data.value) : null,
        stage: parsed.data.stage,
        pendingFinance: parsed.data.pendingFinance,
      },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "SALES",
      entityType: "DEAL",
      entityId: created.id,
      action: "CREATE",
      summary: "Created deal.",
      metadata: { stage: parsed.data.stage, pendingFinance: parsed.data.pendingFinance },
    });
    if (created.leadId) void recalculateLeadScore(created.leadId);
  } catch {
    return { ok: false, error: "Could not create deal right now." };
  }

  revalidatePath(`/${tenantSlug}/deals`);
  revalidatePath(`/${tenantSlug}/leads`);
  return { ok: true };
}

export async function moveDealStage(
  tenantSlug: string,
  dealId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = parseMoveDealStageForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
  }

  const { tenant, isActiveMember } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!(session.user.isPlatformAdmin || isActiveMember)) {
    return { ok: false, error: "You do not have permission to move deal stages." };
  }

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, tenantId: tenant.id },
    select: { id: true, unitId: true },
  });
  if (!deal) return { ok: false, error: "Deal not found." };

  if (parsed.data.stage === DealStage.RESERVATION_MADE && deal.unitId) {
    const unit = await prisma.unit.findFirst({
      where: { id: deal.unitId, tenantId: tenant.id },
      select: { status: true },
    });
    if (!unit || unit.status !== UnitStatus.RESERVED) {
      return { ok: false, error: "Deal cannot move to Reservation Made unless its unit is reserved." };
    }
  }

  try {
    await prisma.deal.update({
      where: { id: deal.id },
      data: { stage: parsed.data.stage },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "SALES",
      entityType: "DEAL",
      entityId: deal.id,
      action: "UPDATE_STAGE",
      summary: "Moved deal stage.",
      metadata: { stage: parsed.data.stage },
    });
    // Re-score the linked lead when deal stage changes
    const linked = await prisma.deal.findUnique({
      where: { id: deal.id },
      select: { leadId: true },
    });
    if (linked?.leadId) void recalculateLeadScore(linked.leadId);
  } catch {
    return { ok: false, error: "Could not move deal stage right now." };
  }

  revalidatePath(`/${tenantSlug}/deals`);
  revalidatePath(`/${tenantSlug}/leads`);
  return { ok: true };
}

export async function updateDeal(
  tenantSlug: string,
  dealId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const { tenant, isActiveMember } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Tenant not found." };
  if (!(session.user.isPlatformAdmin || isActiveMember)) {
    return { ok: false, error: "You do not have permission to edit deals." };
  }

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, tenantId: tenant.id },
    select: { id: true },
  });
  if (!deal) return { ok: false, error: "Deal not found." };

  const valueRaw = formData.get("value");
  const value = valueRaw && valueRaw !== "" ? Number(valueRaw) : null;
  if (valueRaw && valueRaw !== "" && Number.isNaN(value)) {
    return { ok: false, error: "Value must be a valid number." };
  }

  const assignedUserId = formData.get("assignedUserId");
  const pendingFinance = formData.get("pendingFinance") === "on";
  const notes = formData.get("notes");

  if (assignedUserId && assignedUserId !== "") {
    const assignee = await prisma.membership.findFirst({
      where: { tenantId: tenant.id, userId: String(assignedUserId), status: MembershipStatus.ACTIVE },
      select: { id: true },
    });
    if (!assignee) return { ok: false, error: "Assigned owner is invalid." };
  }

  try {
    await prisma.deal.update({
      where: { id: deal.id },
      data: {
        value: value,
        assignedUserId: assignedUserId ? String(assignedUserId) : null,
        pendingFinance,
        ...(notes !== null && notes !== "" ? {} : {}),
      },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "SALES",
      entityType: "DEAL",
      entityId: deal.id,
      action: "UPDATE",
      summary: "Updated deal details.",
    });
  } catch {
    return { ok: false, error: "Could not update deal right now." };
  }

  revalidatePath(`/${tenantSlug}/deals`);
  revalidatePath(`/${tenantSlug}/deals/${dealId}`);
  return { ok: true };
}

export async function moveDealStageDirect(
  tenantSlug: string,
  dealId: string,
  targetStage: DealStage,
): Promise<ActionResult> {
  const fd = new FormData();
  fd.set("stage", targetStage);
  return moveDealStage(tenantSlug, dealId, null, fd);
}
