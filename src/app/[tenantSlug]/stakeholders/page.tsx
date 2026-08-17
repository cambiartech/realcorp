import { auth } from "@/auth";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import { assertTenantNavAccess, MEMBERSHIP_FOR_NAV_SELECT } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { StakeholdersWorkspace } from "./stakeholders-workspace";

export const dynamic = "force-dynamic";

export default async function StakeholdersPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
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
          moduleSales: true,
          moduleFinance: true,
          moduleMarketing: true,
          moduleCommunity: true,
          moduleListings: true,
          moduleWhatsApp: true,
          moduleInvestorPortal: true,
          roleModuleGrants: true,
        },
      },
    },
  });
  if (!tenant) notFound();
  if (tenant.settings?.moduleInvestorPortal !== true) notFound();

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: MEMBERSHIP_FOR_NAV_SELECT,
  });
  assertTenantNavAccess(session, membership, tenant.settings, "stakeholders");

  const canManage =
    session.user.isPlatformAdmin ||
    (membership?.status === MembershipStatus.ACTIVE &&
      (membership.role === MembershipRole.ORG_ADMIN || membership.role === MembershipRole.SALES_MANAGER));

  const [projects, stakeholders, portalMembers] = await Promise.all([
    prisma.project.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.projectStakeholder.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        projectId: true,
        userId: true,
        type: true,
        sharePercent: true,
        investmentAmount: true,
        user: { select: { name: true, email: true } },
        project: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.membership.findMany({
      where: {
        tenantId: tenant.id,
        status: MembershipStatus.ACTIVE,
        role: { in: [MembershipRole.INVESTOR, MembershipRole.LISTING_OWNER] },
      },
      select: {
        userId: true,
        role: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <StakeholdersWorkspace
      tenantSlug={tenant.slug}
      canManage={canManage}
      projects={projects}
      stakeholders={stakeholders.map((s) => ({
        id: s.id,
        projectId: s.projectId,
        userId: s.userId,
        type: s.type,
        investmentAmount: s.investmentAmount != null ? Number(s.investmentAmount) : null,
        label: s.user.name || s.user.email || "Member",
        projectName: s.project.name,
      }))}
      portalMembers={portalMembers.map((m) => ({
        userId: m.userId,
        role: m.role as "INVESTOR" | "LISTING_OWNER",
        label: m.user.name || m.user.email || "Member",
      }))}
    />
  );
}
