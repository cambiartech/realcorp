import { auth } from "@/auth";
import { MarketingLeadRouting, MembershipRole, MembershipStatus } from "@/generated/prisma";
import { assertTenantNavAccess, MEMBERSHIP_FOR_NAV_SELECT } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { MarketingSettingsWorkspace } from "./settings-workspace";

export const dynamic = "force-dynamic";

function canManageMarketing(role: MembershipRole | undefined, isPlatformAdmin: boolean) {
  return isPlatformAdmin || role === MembershipRole.ORG_ADMIN || role === MembershipRole.MARKETING_MANAGER;
}

export default async function MarketingSettingsPage({
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
      slug: true,
      settings: {
        select: {
          marketingLeadRouting: true,
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

  const canEdit =
    Boolean(session.user.isPlatformAdmin) ||
    (membership?.status === MembershipStatus.ACTIVE &&
      canManageMarketing(membership.role, false));

  const pendingCount = await prisma.lead.count({
    where: { tenantId: tenant.id, salesVisible: false },
  });

  return (
    <MarketingSettingsWorkspace
      tenantSlug={tenant.slug}
      routing={tenant.settings?.marketingLeadRouting ?? MarketingLeadRouting.SALES_IMMEDIATE}
      pendingCount={pendingCount}
      canEdit={canEdit}
    />
  );
}
