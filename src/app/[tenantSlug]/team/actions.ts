"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import prisma from "@/lib/db";
import { parseTeamInviteForm } from "@/lib/validators/team-invite";
import { z } from "zod";

export type TeamInviteResult =
  | { ok: true; inviteUrl: string }
  | { ok: false; error: string };

export async function inviteTenantMember(
  tenantSlug: string,
  _prev: TeamInviteResult | null,
  formData: FormData,
): Promise<TeamInviteResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = parseTeamInviteForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((issue) => issue.message).join(" ") };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });
  if (!tenant) {
    return { ok: false, error: "Tenant not found." };
  }

  const membership = await prisma.membership.findUnique({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: session.user.id,
      },
    },
    select: { role: true, status: true },
  });

  const canInvite =
    session.user.isPlatformAdmin ||
    (membership?.status === MembershipStatus.ACTIVE && membership.role === MembershipRole.ORG_ADMIN);

  if (!canInvite) {
    return { ok: false, error: "Only org admins can invite team members." };
  }

  const email = parsed.data.email.toLowerCase();
  const role = parsed.data.role as MembershipRole;
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  try {
    await prisma.invitation.create({
      data: {
        tenantId: tenant.id,
        email,
        role,
        token,
        expiresAt,
      },
    });
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel: session.user.name || session.user.email || "Unknown",
      module: "TEAM",
      entityType: "INVITATION",
      action: "CREATE",
      summary: `Invited ${email} as ${role}.`,
      metadata: { email, role },
    });
  } catch {
    return { ok: false, error: "Could not create invite right now. Try again." };
  }

  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const inviteUrl = `${base}/join?token=${token}`;

  revalidatePath(`/${tenantSlug}/team`);
  return { ok: true, inviteUrl };
}

const updateRoleSchema = z.object({
  membershipId: z.string().min(1),
  role: z.nativeEnum(MembershipRole),
});

export async function updateMembershipRole(
  tenantSlug: string,
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = updateRoleSchema.safeParse({
    membershipId: String(formData.get("membershipId") || "").trim(),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid role or member." };
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
  if (!tenant) {
    return { ok: false, error: "Organization not found." };
  }

  const actorMembership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true, status: true },
  });

  const canManage =
    session.user.isPlatformAdmin ||
    (actorMembership?.status === MembershipStatus.ACTIVE && actorMembership.role === MembershipRole.ORG_ADMIN);
  if (!canManage) {
    return { ok: false, error: "Only organization admins can change roles." };
  }

  const target = await prisma.membership.findFirst({
    where: { id: parsed.data.membershipId, tenantId: tenant.id },
    select: { id: true, role: true },
  });
  if (!target) {
    return { ok: false, error: "Member not found." };
  }

  if (target.role === MembershipRole.ORG_ADMIN && parsed.data.role !== MembershipRole.ORG_ADMIN) {
    const adminCount = await prisma.membership.count({
      where: {
        tenantId: tenant.id,
        role: MembershipRole.ORG_ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });
    if (adminCount <= 1) {
      return { ok: false, error: "Keep at least one organization admin." };
    }
  }

  await prisma.membership.update({
    where: { id: target.id },
    data: { role: parsed.data.role },
  });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "TEAM",
    entityType: "MEMBERSHIP",
    action: "UPDATE",
    summary: `Updated member role to ${parsed.data.role}.`,
    metadata: { membershipId: target.id, role: parsed.data.role },
  });

  revalidatePath(`/${tenantSlug}/team`);
  revalidatePath(`/${tenantSlug}`, "layout");
  return { ok: true };
}
