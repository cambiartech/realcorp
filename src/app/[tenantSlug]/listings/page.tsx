import { auth } from "@/auth";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import { assertTenantNavAccess, MEMBERSHIP_FOR_NAV_SELECT } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { ListingsWorkspace } from "./listings-workspace";

export const dynamic = "force-dynamic";

export default async function ListingsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
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
  if (tenant.settings?.moduleListings === false) notFound();

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: MEMBERSHIP_FOR_NAV_SELECT,
  });
  assertTenantNavAccess(session, membership, tenant.settings, "listings");

  const canManage =
    session.user.isPlatformAdmin ||
    (membership?.status === MembershipStatus.ACTIVE &&
      (membership.role === MembershipRole.ORG_ADMIN || membership.role === MembershipRole.SALES_MANAGER));

  const projects = await prisma.project.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <ListingsWorkspace
      tenantSlug={tenant.slug}
      canManage={canManage}
      projects={projects.map((project) => ({
        id: project.id,
        name: project.name,
        isPublished: project.isPublished,
        listingDescription: project.listingDescription,
        locationCity: project.locationCity,
        locationState: project.locationState,
        locationCountry: project.locationCountry,
        locationAddress: project.locationAddress,
        coverImageUrl: project.coverImageUrl,
        galleryUrls: Array.isArray(project.galleryUrls)
          ? (project.galleryUrls as string[]).filter((u): u is string => typeof u === "string")
          : [],
        amenities: Array.isArray(project.amenities)
          ? (project.amenities as string[]).filter((a): a is string => typeof a === "string")
          : [],
      }))}
    />
  );
}
