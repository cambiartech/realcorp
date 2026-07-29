import prisma from "@/lib/db";

export type TenantMemberCleanupResult =
  | { ok: true; purgedUser: boolean; email: string | null }
  | { ok: false; error: string };

/**
 * Remove a user from a tenant (membership, invites, HR profile, prefs).
 * Optionally delete the User row when they have no other org memberships.
 */
export async function removeTenantMember(input: {
  tenantId: string;
  userId: string;
  purgeUserAccount?: boolean;
}): Promise<TenantMemberCleanupResult> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      email: true,
      isPlatformAdmin: true,
      memberships: { select: { tenantId: true } },
    },
  });
  if (!user) return { ok: false, error: "User not found." };

  const membership = user.memberships.find((m) => m.tenantId === input.tenantId);
  if (!membership) return { ok: false, error: "User is not a member of this organization." };

  if (input.purgeUserAccount) {
    if (user.isPlatformAdmin) {
      return { ok: false, error: "Cannot delete a platform administrator account." };
    }
    const otherTenants = user.memberships.filter((m) => m.tenantId !== input.tenantId);
    if (otherTenants.length > 0) {
      return {
        ok: false,
        error: "User belongs to other organizations. Remove them from those orgs first, or use “Remove from org” only.",
      };
    }
  }

  const normalizedEmail = user.email?.toLowerCase() ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.membership.deleteMany({
      where: { tenantId: input.tenantId, userId: input.userId },
    });

    if (normalizedEmail) {
      await tx.invitation.deleteMany({
        where: { tenantId: input.tenantId, email: normalizedEmail },
      });
    }

    await tx.employeeProfile.deleteMany({
      where: { tenantId: input.tenantId, userId: input.userId },
    });

    await tx.dashboardPreference.deleteMany({
      where: { tenantId: input.tenantId, userId: input.userId },
    });

    await tx.projectStakeholder.deleteMany({
      where: { tenantId: input.tenantId, userId: input.userId },
    });

    if (input.purgeUserAccount) {
      await tx.user.delete({ where: { id: input.userId } });
    }
  });

  return { ok: true, purgedUser: Boolean(input.purgeUserAccount), email: user.email };
}

export async function deleteTenantInvitation(input: {
  tenantId: string;
  invitationId: string;
}): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const invite = await prisma.invitation.findFirst({
    where: { id: input.invitationId, tenantId: input.tenantId },
    select: { id: true, email: true, acceptedAt: true },
  });
  if (!invite) return { ok: false, error: "Invite not found." };
  if (invite.acceptedAt) {
    return { ok: false, error: "Accepted invites cannot be deleted — remove the member instead." };
  }

  await prisma.invitation.delete({ where: { id: invite.id } });
  return { ok: true, email: invite.email };
}
