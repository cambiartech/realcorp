import { auth } from "@/auth";
import { CaptureFormNewWorkspace } from "@/components/capture-forms/capture-form-new-workspace";
import { assertTenantNavAccess, MEMBERSHIP_FOR_NAV_SELECT } from "@/lib/guard-tenant-nav";
import { canEditMarketing } from "@/lib/marketing-access";
import prisma from "@/lib/db";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

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
    select: MEMBERSHIP_FOR_NAV_SELECT,
  });
  assertTenantNavAccess(session, membership, tenant.settings, "marketing");
  if (!canEditMarketing(Boolean(session.user.isPlatformAdmin), membership)) {
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
