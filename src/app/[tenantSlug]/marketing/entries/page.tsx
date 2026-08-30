import { auth } from "@/auth";
import { MarketingLeadRouting, MembershipStatus } from "@/generated/prisma";
import { assertTenantNavAccess, MEMBERSHIP_FOR_NAV_SELECT } from "@/lib/guard-tenant-nav";
import { canEditMarketing } from "@/lib/marketing-access";
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { MarketingEntriesWorkspace } from "./entries-workspace";

export const dynamic = "force-dynamic";

export default async function MarketingEntriesPage({
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

  const canEdit = canEditMarketing(Boolean(session.user.isPlatformAdmin), membership);

  const [entries, members] = await Promise.all([
    prisma.lead.findMany({
      where: { tenantId: tenant.id, salesVisible: false },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        source: true,
        assignedUserId: true,
        createdAt: true,
        campaign: { select: { name: true } },
        campaignName: true,
      },
      take: 200,
    }),
    prisma.membership.findMany({
      where: { tenantId: tenant.id, status: MembershipStatus.ACTIVE },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
  ]);

  return (
    <MarketingEntriesWorkspace
      tenantSlug={tenant.slug}
      routingIsHold={tenant.settings?.marketingLeadRouting === MarketingLeadRouting.MARKETING_HOLD}
      entries={entries.map((entry) => ({
        id: entry.id,
        name: entry.name || "",
        email: entry.email || "",
        phone: entry.phone || "",
        source: entry.source || "",
        campaign: entry.campaign?.name || entry.campaignName || "",
        assignedUserId: entry.assignedUserId || "",
        createdAt: new Intl.DateTimeFormat("en-NG", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(entry.createdAt),
      }))}
      teamMembers={members.map((member) => ({
        id: member.user.id,
        label: member.user.name || member.user.email || "Team member",
      }))}
      canEdit={canEdit}
    />
  );
}
