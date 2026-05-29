import { auth } from "@/auth";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import { CaptureFormNewWorkspace } from "@/components/capture-forms/capture-form-new-workspace";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function canManageMarketing(role: MembershipRole | undefined, isPlatformAdmin: boolean) {
  return isPlatformAdmin || role === MembershipRole.ORG_ADMIN || role === MembershipRole.MARKETING_MANAGER;
}

export default async function CaptureFormNewPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
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
  assertTenantNavAccess(session, membership, tenant.settings, "marketing");
  if (
    membership?.status !== MembershipStatus.ACTIVE ||
    !canManageMarketing(membership.role, Boolean(session.user.isPlatformAdmin))
  ) {
    notFound();
  }

  const [campaigns, partners] = await Promise.all([
    prisma.campaign.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.realtorPartner.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
  ]);

  return <CaptureFormNewWorkspace tenantSlug={tenantSlug} campaigns={campaigns} partners={partners} />;
}
