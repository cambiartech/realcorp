"use server";

import { auth } from "@/auth";
import { MembershipStatus } from "@/generated/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import prisma from "@/lib/db";
import { parseCreateLeadForm } from "@/lib/validators/lead";
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
  } catch {
    return { ok: false, error: "Could not create lead right now." };
  }

  revalidatePath(`/${tenantSlug}/leads`);
  return { ok: true };
}
