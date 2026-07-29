"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import prisma from "@/lib/db";
import { sendInviteEmail } from "@/lib/email";
import { buildInviteUrl, inviteExpiresAt, newInviteToken } from "@/lib/invitation-utils";
import { parseTeamInviteForm, inviteProfileFromForm, resolveRoleFromTeamInviteForm } from "@/lib/validators/team-invite";
import { membershipRoleLabel, profileFromMembershipRole } from "@/lib/org-membership-profile";
import { Prisma } from "@/generated/prisma";
import {
  membershipModulePermissionsToJson,
  parseMembershipModulePermissionsFromForm,
} from "@/lib/membership-module-permissions";
import { z } from "zod";

export type TeamInviteResult =
  { ok: true; inviteUrl: string; emailSent: boolean; emailError?: string } | { ok: false; error: string };

type ActionResult = { ok: true } | { ok: false; error: string };

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
    select: { id: true, name: true },
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
  const role = resolveRoleFromTeamInviteForm(parsed.data);
  const profile = inviteProfileFromForm(parsed.data);

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingUser) {
    const activeMember = await prisma.membership.findFirst({
      where: {
        tenantId: tenant.id,
        userId: existingUser.id,
        status: MembershipStatus.ACTIVE,
      },
      select: { role: true },
    });
    if (activeMember) {
      return {
        ok: false,
        error: `${email} is already an active team member (${activeMember.role.replace(/_/g, " ").toLowerCase()}). Update their role on the Members tab instead of sending a new invite.`,
      };
    }
  }

  const pendingInvite = await prisma.invitation.findFirst({
    where: {
      tenantId: tenant.id,
      email,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { role: true, expiresAt: true },
  });
  if (pendingInvite) {
    const roleLabel = pendingInvite.role.replace(/_/g, " ").toLowerCase();
    const expiresLabel = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(
      pendingInvite.expiresAt,
    );
    return {
      ok: false,
      error: `An invite for ${email} is already pending (${roleLabel}, expires ${expiresLabel}). Go to Pending invites and use Resend — do not create a duplicate.`,
    };
  }

  const token = newInviteToken();
  const expiresAt = inviteExpiresAt();

  try {
    await prisma.invitation.create({
      data: {
        tenantId: tenant.id,
        email,
        role,
        department: profile.department,
        isDepartmentLead: profile.isDepartmentLead,
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

  const inviteUrl = buildInviteUrl(token);

  const inviterLabel = session.user.name || session.user.email || "Organization admin";
  const emailResult = await sendInviteEmail({
    to: email,
    tenantName: tenant.name,
    inviterLabel,
    inviteUrl,
    roleLabel: membershipRoleLabel(role, profile.department, profile.isDepartmentLead),
  });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: inviterLabel,
    module: "TEAM",
    entityType: "INVITATION",
    action: emailResult.ok ? "EMAIL_SENT" : "EMAIL_FAILED",
    summary: emailResult.ok
      ? `Invitation email sent to ${email}.`
      : `Invitation email failed for ${email}: ${emailResult.error}`,
    metadata: { email, role, ok: emailResult.ok },
  });

  revalidatePath(`/${tenantSlug}/team`);
  return {
    ok: true,
    inviteUrl,
    emailSent: emailResult.ok,
    ...(emailResult.ok ? {} : { emailError: emailResult.error }),
  };
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
    (actorMembership?.status === MembershipStatus.ACTIVE &&
      actorMembership.role === MembershipRole.ORG_ADMIN);
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

  const profile = profileFromMembershipRole(parsed.data.role);

  await prisma.membership.update({
    where: { id: target.id },
    data: {
      role: parsed.data.role,
      department: profile.department,
      isDepartmentLead: profile.isDepartmentLead,
    },
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

export async function resendInvitation(tenantSlug: string, invitationId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, name: true },
  });
  if (!tenant) return { ok: false, error: "Organization not found." };

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true, status: true },
  });
  const canManage =
    session.user.isPlatformAdmin ||
    (membership?.status === MembershipStatus.ACTIVE && membership.role === MembershipRole.ORG_ADMIN);
  if (!canManage) return { ok: false, error: "Only organization admins can manage invites." };

  const invite = await prisma.invitation.findFirst({
    where: { id: invitationId, tenantId: tenant.id, acceptedAt: null },
    select: { id: true, token: true, email: true, role: true, expiresAt: true },
  });
  if (!invite) return { ok: false, error: "Invite not found or already accepted." };

  let token = invite.token;
  let expiresAt = invite.expiresAt;
  if (expiresAt <= new Date()) {
    token = newInviteToken();
    expiresAt = inviteExpiresAt();
    await prisma.invitation.update({
      where: { id: invite.id },
      data: { token, expiresAt },
    });
  }

  const inviteUrl = buildInviteUrl(token);
  const actorLabel = session.user.name || session.user.email || "Organization admin";
  const emailResult = await sendInviteEmail({
    to: invite.email,
    tenantName: tenant.name,
    inviterLabel: actorLabel,
    inviteUrl,
    roleLabel: invite.role,
  });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel,
    module: "TEAM",
    entityType: "INVITATION",
    entityId: invite.id,
    action: emailResult.ok ? "RESEND_EMAIL_SENT" : "RESEND_EMAIL_FAILED",
    summary: emailResult.ok
      ? `Resent invitation email to ${invite.email}.`
      : `Resend failed for ${invite.email}: ${emailResult.error}`,
    metadata: { email: invite.email, role: invite.role, ok: emailResult.ok },
  });

  revalidatePath(`/${tenantSlug}/team`);
  return emailResult.ok
    ? { ok: true }
    : { ok: false, error: emailResult.error || "Failed to send invite email." };
}

export async function refreshInvitationToken(
  tenantSlug: string,
  invitationId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, name: true },
  });
  if (!tenant) return { ok: false, error: "Organization not found." };

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true, status: true },
  });
  const canManage =
    session.user.isPlatformAdmin ||
    (membership?.status === MembershipStatus.ACTIVE && membership.role === MembershipRole.ORG_ADMIN);
  if (!canManage) return { ok: false, error: "Only organization admins can manage invites." };

  const invite = await prisma.invitation.findFirst({
    where: { id: invitationId, tenantId: tenant.id, acceptedAt: null },
    select: { id: true, email: true, role: true },
  });
  if (!invite) return { ok: false, error: "Invite not found or already accepted." };

  const token = newInviteToken();
  await prisma.invitation.update({
    where: { id: invite.id },
    data: { token, expiresAt: inviteExpiresAt() },
  });

  const inviteUrl = buildInviteUrl(token);
  const actorLabel = session.user.name || session.user.email || "Organization admin";
  const emailResult = await sendInviteEmail({
    to: invite.email,
    tenantName: tenant.name,
    inviterLabel: actorLabel,
    inviteUrl,
    roleLabel: invite.role,
  });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel,
    module: "TEAM",
    entityType: "INVITATION",
    entityId: invite.id,
    action: emailResult.ok ? "REFRESH_TOKEN_SENT" : "REFRESH_TOKEN_EMAIL_FAILED",
    summary: emailResult.ok
      ? `Refreshed invite token and emailed ${invite.email}.`
      : `Token refreshed but email failed for ${invite.email}: ${emailResult.error}`,
    metadata: { email: invite.email, role: invite.role, ok: emailResult.ok },
  });

  revalidatePath(`/${tenantSlug}/team`);
  return emailResult.ok
    ? { ok: true }
    : { ok: false, error: emailResult.error || "Failed to send invite email." };
}

export async function deleteInvitation(tenantSlug: string, invitationId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
  if (!tenant) return { ok: false, error: "Organization not found." };

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true, status: true },
  });
  const canManage =
    session.user.isPlatformAdmin ||
    (membership?.status === MembershipStatus.ACTIVE && membership.role === MembershipRole.ORG_ADMIN);
  if (!canManage) return { ok: false, error: "Only organization admins can manage invites." };

  const invite = await prisma.invitation.findFirst({
    where: { id: invitationId, tenantId: tenant.id, acceptedAt: null },
    select: { id: true, email: true, role: true },
  });
  if (!invite) return { ok: false, error: "Invite not found or already accepted." };

  await prisma.invitation.delete({ where: { id: invite.id } });
  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "TEAM",
    entityType: "INVITATION",
    entityId: invite.id,
    action: "DELETE",
    summary: `Deleted pending invite for ${invite.email}.`,
    metadata: { email: invite.email, role: invite.role },
  });

  revalidatePath(`/${tenantSlug}/team`);
  return { ok: true };
}

export async function setMembershipStatus(
  tenantSlug: string,
  membershipId: string,
  status: "ACTIVE" | "SUSPENDED",
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
  if (!tenant) return { ok: false, error: "Organization not found." };

  const actorMembership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true, status: true },
  });
  const canManage =
    session.user.isPlatformAdmin ||
    (actorMembership?.status === MembershipStatus.ACTIVE &&
      actorMembership.role === MembershipRole.ORG_ADMIN);
  if (!canManage) return { ok: false, error: "Only organization admins can manage members." };

  const target = await prisma.membership.findFirst({
    where: { id: membershipId, tenantId: tenant.id },
    select: { id: true, role: true, status: true, userId: true },
  });
  if (!target) return { ok: false, error: "Member not found." };
  if (!session.user.isPlatformAdmin && target.userId === session.user.id) {
    return { ok: false, error: "You cannot disable your own account." };
  }

  if (target.role === MembershipRole.ORG_ADMIN && status === "SUSPENDED") {
    const activeOrgAdmins = await prisma.membership.count({
      where: { tenantId: tenant.id, role: MembershipRole.ORG_ADMIN, status: MembershipStatus.ACTIVE },
    });
    if (activeOrgAdmins <= 1) return { ok: false, error: "Keep at least one active organization admin." };
  }

  await prisma.membership.update({
    where: { id: target.id },
    data: { status: status === "ACTIVE" ? MembershipStatus.ACTIVE : MembershipStatus.SUSPENDED },
  });
  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "TEAM",
    entityType: "MEMBERSHIP",
    entityId: target.id,
    action: status === "ACTIVE" ? "ENABLE_MEMBER" : "DISABLE_MEMBER",
    summary: `${status === "ACTIVE" ? "Enabled" : "Disabled"} member account.`,
    metadata: { membershipId: target.id, status },
  });

  revalidatePath(`/${tenantSlug}/team`);
  revalidatePath(`/${tenantSlug}`, "layout");
  return { ok: true };
}

export async function saveMembershipModulePermissions(
  tenantSlug: string,
  membershipId: string,
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug }, select: { id: true } });
  if (!tenant) return { ok: false, error: "Organization not found." };

  const actorMembership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true, status: true },
  });
  const canManage =
    session.user.isPlatformAdmin ||
    (actorMembership?.status === MembershipStatus.ACTIVE &&
      actorMembership.role === MembershipRole.ORG_ADMIN);
  if (!canManage) return { ok: false, error: "Only organization admins can change module access." };

  const target = await prisma.membership.findFirst({
    where: { id: membershipId, tenantId: tenant.id },
    select: { id: true, userId: true, role: true },
  });
  if (!target) return { ok: false, error: "Member not found." };
  if (target.role === MembershipRole.ORG_ADMIN) {
    return { ok: false, error: "Organization admins always have full module access." };
  }

  const parsed = parseMembershipModulePermissionsFromForm(formData);
  const json = membershipModulePermissionsToJson(parsed);

  await prisma.membership.update({
    where: { id: target.id },
    data: {
      modulePermissions: json === null ? Prisma.JsonNull : (json as Prisma.InputJsonValue),
    },
  });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "Unknown",
    module: "TEAM",
    entityType: "MEMBERSHIP",
    entityId: target.id,
    action: "UPDATE",
    summary: "Updated per-user module permissions.",
    metadata: { membershipId: target.id, modulePermissions: json },
  });

  revalidatePath(`/${tenantSlug}/team`);
  revalidatePath(`/${tenantSlug}`, "layout");
  return { ok: true };
}
