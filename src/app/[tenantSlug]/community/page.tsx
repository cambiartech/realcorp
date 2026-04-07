import { auth } from "@/auth";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { CommunityWorkspace } from "./community-workspace";

export const dynamic = "force-dynamic";

function canManageCommunity(role: MembershipRole | undefined, isPlatformAdmin: boolean) {
  return (
    isPlatformAdmin ||
    role === MembershipRole.ORG_ADMIN ||
    role === MembershipRole.COMMUNITY_MANAGER ||
    role === MembershipRole.SALES_MANAGER
  );
}

export default async function CommunityPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      slug: true,
      name: true,
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
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { status: true, role: true },
  });
  assertTenantNavAccess(session, membership, tenant.settings, "community");
  const canEdit =
    membership?.status === MembershipStatus.ACTIVE &&
    canManageCommunity(membership.role, Boolean(session.user.isPlatformAdmin));

  const [partners, monthLeads] = await Promise.all([
    prisma.realtorPartner.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { leads: true } } },
      take: 200,
    }),
    prisma.lead.count({
      where: {
        tenantId: tenant.id,
        realtorPartnerId: { not: null },
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),
  ]);

  const activePartners = partners.filter((p) => p.isActive).length;
  const portalReady = partners.filter((p) => p.portalTokenHash).length;

  return (
    <CommunityWorkspace
      tenantSlug={tenant.slug}
      tenantName={tenant.name}
      canEdit={canEdit}
      partners={partners.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        email: p.email,
        phone: p.phone,
        company: p.company,
        territory: p.territory,
        isActive: p.isActive,
        hasPortal: Boolean(p.portalTokenHash),
        leadCount: p._count.leads,
        createdAt: p.createdAt.toISOString().slice(0, 10),
      }))}
      summary={{
        totalPartners: partners.length,
        activePartners,
        portalReady,
        monthLeads,
      }}
    />
  );
}
