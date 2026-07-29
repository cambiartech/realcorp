"use server";

import { auth } from "@/auth";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import prisma from "@/lib/db";
import { parseCreateCampaignForm } from "@/lib/validators/campaign";
import { revalidatePath } from "next/cache";

type ActionResult = { ok: true } | { ok: false; error: string };

function canManageMarketing(role: MembershipRole | undefined, isPlatformAdmin: boolean) {
  return isPlatformAdmin || role === MembershipRole.ORG_ADMIN || role === MembershipRole.MARKETING_MANAGER;
}

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
  if (
    !membership ||
    membership.status !== MembershipStatus.ACTIVE ||
    !canManageMarketing(membership.role, Boolean(session.user.isPlatformAdmin))
  ) {
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
