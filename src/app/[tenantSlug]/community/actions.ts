"use server";

import { auth } from "@/auth";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import prisma from "@/lib/db";
import { generatePortalToken } from "@/lib/portal-token";
import { parseCreateRealtorPartnerForm } from "@/lib/validators/realtor-partner";
import { revalidatePath } from "next/cache";

type ActionResult = { ok: true } | { ok: false; error: string };

export type RotatePortalResult =
  | { ok: true; rawToken: string; relativePath: string }
  | { ok: false; error: string };

function canManageCommunity(role: MembershipRole | undefined, isPlatformAdmin: boolean) {
  return (
    isPlatformAdmin ||
    role === MembershipRole.ORG_ADMIN ||
    role === MembershipRole.COMMUNITY_MANAGER ||
    role === MembershipRole.SALES_MANAGER
  );
}

export async function createRealtorPartner(
  tenantSlug: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const parsed = parseCreateRealtorPartnerForm(formData);
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
    !canManageCommunity(membership.role, Boolean(session.user.isPlatformAdmin))
  ) {
    return { ok: false, error: "You do not have permission to manage realtor partners." };
  }

  try {
    const partner = await prisma.realtorPartner.create({
      data: {
        tenantId: tenant.id,
        displayName: parsed.data.displayName,
        email: parsed.data.email ?? null,
        phone: parsed.data.phone ?? null,
        company: parsed.data.company ?? null,
        territory: parsed.data.territory ?? null,
        notes: parsed.data.notes ?? null,
      },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "COMMUNITY",
      entityType: "REALTOR_PARTNER",
      entityId: partner.id,
      action: "CREATE",
      summary: `Added realtor partner ${partner.displayName}.`,
    });
  } catch {
    return { ok: false, error: "Could not create partner." };
  }

  revalidatePath(`/${tenantSlug}/community`);
  return { ok: true };
}

export async function rotateRealtorPortalToken(tenantSlug: string, partnerId: string): Promise<RotatePortalResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

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
    !canManageCommunity(membership.role, Boolean(session.user.isPlatformAdmin))
  ) {
    return { ok: false, error: "You do not have permission." };
  }

  const partner = await prisma.realtorPartner.findFirst({
    where: { id: partnerId, tenantId: tenant.id },
    select: { id: true, displayName: true },
  });
  if (!partner) return { ok: false, error: "Partner not found." };

  const { raw, hash } = generatePortalToken();

  await prisma.realtorPartner.update({
    where: { id: partner.id },
    data: { portalTokenHash: hash },
  });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "COMMUNITY",
    entityType: "REALTOR_PARTNER",
    entityId: partner.id,
    action: "ROTATE_PORTAL",
    summary: `Rotated portal access for ${partner.displayName}.`,
  });

  revalidatePath(`/${tenantSlug}/community`);

  const relativePath = `/realtor/${tenantSlug}/${partner.id}?a=${encodeURIComponent(raw)}`;
  return { ok: true, rawToken: raw, relativePath };
}

export async function setRealtorPartnerActive(
  tenantSlug: string,
  partnerId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

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
    !canManageCommunity(membership.role, Boolean(session.user.isPlatformAdmin))
  ) {
    return { ok: false, error: "You do not have permission." };
  }

  const updated = await prisma.realtorPartner.updateMany({
    where: { id: partnerId, tenantId: tenant.id },
    data: { isActive },
  });
  if (updated.count === 0) return { ok: false, error: "Partner not found." };

  revalidatePath(`/${tenantSlug}/community`);
  return { ok: true };
}
