"use server";

import bcrypt from "bcryptjs";
import prisma from "@/lib/db";
import { MembershipStatus } from "@/generated/prisma";
import { classifyInvite } from "@/lib/invitation-utils";
import { profileFromMembershipRole } from "@/lib/org-membership-profile";
import { parseJoinForm } from "@/lib/validators/join";

export type AcceptInviteResult = { ok: true; redirectTo: string } | { ok: false; error: string };

export async function acceptInvite(
  token: string,
  _prev: AcceptInviteResult | null,
  formData: FormData,
): Promise<AcceptInviteResult> {
  const parsed = parseJoinForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((issue) => issue.message).join(" ") };
  }

  const now = new Date();
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { tenant: true },
  });

  if (!invitation) {
    return { ok: false, error: "This invite link is not recognized. Ask your admin for a new invite." };
  }

  const inviteStatus = classifyInvite(invitation);
  if (inviteStatus === "accepted") {
    return {
      ok: false,
      error: "This invite was already used. Sign in with your email and password instead.",
    };
  }
  if (inviteStatus === "expired") {
    return {
      ok: false,
      error: `This invite expired on ${new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(invitation.expiresAt)}. Ask for a fresh invite link.`,
    };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const inviteEmail = invitation.email.toLowerCase();
  const fullName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim();
  const profile =
    invitation.department != null
      ? { department: invitation.department, isDepartmentLead: invitation.isDepartmentLead }
      : profileFromMembershipRole(invitation.role);

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email: inviteEmail },
        create: {
          email: inviteEmail,
          name: fullName,
          passwordHash,
          emailVerified: now,
        },
        update: {
          name: fullName,
          passwordHash,
          emailVerified: now,
        },
      });

      await tx.membership.upsert({
        where: {
          tenantId_userId: {
            tenantId: invitation.tenantId,
            userId: user.id,
          },
        },
        create: {
          tenantId: invitation.tenantId,
          userId: user.id,
          role: invitation.role,
          department: profile.department,
          isDepartmentLead: profile.isDepartmentLead,
          status: MembershipStatus.ACTIVE,
        },
        update: {
          role: invitation.role,
          department: profile.department,
          isDepartmentLead: profile.isDepartmentLead,
          status: MembershipStatus.ACTIVE,
        },
      });

      const markAccepted = await tx.invitation.updateMany({
        where: { id: invitation.id, acceptedAt: null },
        data: { acceptedAt: now },
      });

      if (markAccepted.count !== 1) {
        throw new Error("Invite was already accepted.");
      }

      await tx.propertyClient.updateMany({
        where: {
          tenantId: invitation.tenantId,
          email: { equals: inviteEmail, mode: "insensitive" },
        },
        data: { userId: user.id },
      });
    });
  } catch {
    const again = await prisma.invitation.findUnique({
      where: { token },
      select: { acceptedAt: true },
    });
    if (again?.acceptedAt) {
      return {
        ok: false,
        error: "This invite was already used. Sign in with your email and password instead.",
      };
    }
    return { ok: false, error: "Could not accept invite right now. Please try again." };
  }

  // Email is passed to the client via sessionStorage (see join-form) — never put credentials in the URL.
  return { ok: true, redirectTo: "/login" };
}
