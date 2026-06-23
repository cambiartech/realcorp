"use server";

import bcrypt from "bcryptjs";
import prisma from "@/lib/db";
import { MembershipStatus } from "@/generated/prisma";
import { parseJoinForm } from "@/lib/validators/join";

export type AcceptInviteResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

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

  if (!invitation || invitation.acceptedAt || invitation.expiresAt <= now) {
    return { ok: false, error: "This invite link is invalid or expired. Request a new invite." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const inviteEmail = invitation.email.toLowerCase();
  const fullName = `${parsed.data.firstName} ${parsed.data.lastName}`.trim();

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
          status: MembershipStatus.ACTIVE,
        },
        update: {
          role: invitation.role,
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
    return { ok: false, error: "Could not accept invite right now. Please try again." };
  }

  // Email is passed to the client via sessionStorage (see join-form) — never put credentials in the URL.
  return { ok: true, redirectTo: "/login" };
}
