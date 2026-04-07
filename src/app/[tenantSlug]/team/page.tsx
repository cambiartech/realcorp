import { auth } from "@/auth";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { formatEnumLabel } from "@/lib/ui-format";
import { notFound } from "next/navigation";
import { TeamWorkspace } from "./team-workspace";

export const dynamic = "force-dynamic";

export default async function TenantTeamPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      name: true,
      slug: true,
      settings: {
        select: {
          moduleSales: true,
          moduleFinance: true,
          moduleMarketing: true,
          moduleCommunity: true,
          roleModuleGrants: true,
        },
      },
    },
  });
  if (!tenant) notFound();

  const membership = await prisma.membership.findUnique({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: session.user.id,
      },
    },
    select: { role: true, status: true },
  });

  assertTenantNavAccess(session, membership, tenant.settings, "team");

  const canInvite =
    session.user.isPlatformAdmin ||
    (membership?.status === MembershipStatus.ACTIVE && membership.role === MembershipRole.ORG_ADMIN);

  const [members, invites] = await Promise.all([
    prisma.membership.findMany({
      where: { tenantId: tenant.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    prisma.invitation.findMany({
      where: { tenantId: tenant.id, acceptedAt: null },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <TeamWorkspace
      tenantName={tenant.name}
      tenantSlug={tenant.slug}
      canInvite={canInvite}
      members={members.map((member) => ({
        id: member.id,
        name: member.user.name || member.user.email || "User",
        email: member.user.email || "No email",
        role: formatEnumLabel(member.role),
        roleValue: member.role,
      }))}
      invites={invites.map((invite) => ({
        id: invite.id,
        email: invite.email,
        role: formatEnumLabel(invite.role),
        expiresAt: invite.expiresAt.toISOString().slice(0, 10),
      }))}
    />
  );
}
