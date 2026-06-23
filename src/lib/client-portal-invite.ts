import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import { sendInviteEmail } from "@/lib/email";
import { buildInviteUrl, inviteExpiresAt, newInviteToken } from "@/lib/invitation-utils";

export const CLIENT_PORTAL_ROLES = [MembershipRole.INVESTOR, MembershipRole.LISTING_OWNER] as const;
export type ClientPortalRole = (typeof CLIENT_PORTAL_ROLES)[number];

export type ClientPortalStatus = "no_email" | "none" | "invited" | "active";

export type ClientPortalInviteResult =
  | { ok: true; emailSent: boolean; alreadyActive?: boolean; emailError?: string }
  | { ok: false; error: string };

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function clientPortalRoleLabel(role: ClientPortalRole) {
  return role === MembershipRole.LISTING_OWNER ? "Listing owner" : "Investor";
}

export async function sendPropertyClientPortalInvite(input: {
  tenantId: string;
  tenantName: string;
  email: string;
  inviterLabel: string;
  role?: ClientPortalRole;
  clientId?: string;
}): Promise<ClientPortalInviteResult> {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "Client email is required to send a portal invite." };

  const role = input.role ?? MembershipRole.INVESTOR;

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    const activePortalMembership = await prisma.membership.findFirst({
      where: {
        tenantId: input.tenantId,
        userId: existingUser.id,
        status: MembershipStatus.ACTIVE,
        role: { in: [...CLIENT_PORTAL_ROLES] },
      },
      select: { id: true },
    });

    if (activePortalMembership) {
      if (input.clientId) {
        await prisma.propertyClient.updateMany({
          where: { id: input.clientId, tenantId: input.tenantId },
          data: { userId: existingUser.id },
        });
      }
      return { ok: true, emailSent: false, alreadyActive: true };
    }

    if (input.clientId) {
      await prisma.propertyClient.updateMany({
        where: { id: input.clientId, tenantId: input.tenantId },
        data: { userId: existingUser.id },
      });
    }
  }

  const pendingInvite = await prisma.invitation.findFirst({
    where: {
      tenantId: input.tenantId,
      email,
      acceptedAt: null,
      role: { in: [...CLIENT_PORTAL_ROLES] },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, token: true, expiresAt: true },
  });

  let token = pendingInvite?.token ?? newInviteToken();
  let expiresAt = pendingInvite?.expiresAt ?? inviteExpiresAt();

  if (pendingInvite) {
    token = newInviteToken();
    expiresAt = inviteExpiresAt();
    await prisma.invitation.update({
      where: { id: pendingInvite.id },
      data: { token, expiresAt, email },
    });
  } else {
    await prisma.invitation.create({
      data: {
        tenantId: input.tenantId,
        email,
        role,
        token,
        expiresAt,
      },
    });
  }

  const inviteUrl = buildInviteUrl(token);
  const emailResult = await sendInviteEmail({
    to: email,
    tenantName: input.tenantName,
    inviterLabel: input.inviterLabel,
    inviteUrl,
    roleLabel: clientPortalRoleLabel(role),
  });

  return {
    ok: true,
    emailSent: emailResult.ok,
    ...(emailResult.ok ? {} : { emailError: emailResult.error }),
  };
}

export async function batchResolveClientPortalStatus(
  tenantId: string,
  clients: Array<{ id: string; email: string | null; userId: string | null }>,
): Promise<Map<string, ClientPortalStatus>> {
  const result = new Map<string, ClientPortalStatus>();
  const emails = [...new Set(clients.map((c) => c.email?.trim().toLowerCase()).filter(Boolean))] as string[];
  const userIds = [...new Set(clients.map((c) => c.userId).filter(Boolean))] as string[];

  const [activeMemberships, pendingInvites, usersByEmail] = await Promise.all([
    userIds.length
      ? prisma.membership.findMany({
          where: {
            tenantId,
            userId: { in: userIds },
            status: MembershipStatus.ACTIVE,
            role: { in: [...CLIENT_PORTAL_ROLES] },
          },
          select: { userId: true },
        })
      : Promise.resolve([]),
    emails.length
      ? prisma.invitation.findMany({
          where: {
            tenantId,
            email: { in: emails },
            acceptedAt: null,
            expiresAt: { gt: new Date() },
            role: { in: [...CLIENT_PORTAL_ROLES] },
          },
          select: { email: true },
        })
      : Promise.resolve([]),
    emails.length
      ? prisma.user.findMany({
          where: { email: { in: emails } },
          select: { id: true, email: true, memberships: { where: { tenantId }, select: { status: true, role: true } } },
        })
      : Promise.resolve([]),
  ]);

  const activeUserIds = new Set(activeMemberships.map((m) => m.userId));
  const invitedEmails = new Set(pendingInvites.map((i) => i.email.toLowerCase()));
  const userPortalActiveByEmail = new Map<string, boolean>();
  for (const user of usersByEmail) {
    if (!user.email) continue;
    const hasPortal = user.memberships.some(
      (m) => m.status === MembershipStatus.ACTIVE && CLIENT_PORTAL_ROLES.includes(m.role as ClientPortalRole),
    );
    userPortalActiveByEmail.set(user.email.toLowerCase(), hasPortal);
  }

  for (const client of clients) {
    if (!client.email?.trim()) {
      result.set(client.id, "no_email");
      continue;
    }
    const email = client.email.trim().toLowerCase();
    if (client.userId && activeUserIds.has(client.userId)) {
      result.set(client.id, "active");
      continue;
    }
    if (userPortalActiveByEmail.get(email)) {
      result.set(client.id, "active");
      continue;
    }
    if (invitedEmails.has(email)) {
      result.set(client.id, "invited");
      continue;
    }
    result.set(client.id, "none");
  }

  return result;
}