import { auth } from "@/auth";
import prisma from "@/lib/db";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import type { TenantNavKey } from "@/lib/tenant-nav-access";
import { notFound, redirect } from "next/navigation";

const MODULE_SETTINGS_SELECT = {
  moduleSales: true,
  moduleFinance: true,
  moduleMarketing: true,
  moduleCommunity: true,
  moduleShortLets: true,
  moduleHr: true,
  moduleTasks: true,
  moduleClients: true,
  moduleListings: true,
  moduleWhatsApp: true,
  moduleInvestorPortal: true,
  roleModuleGrants: true,
} as const;

/** Shared layout guard: auth + module entitlement + role nav access. */
export async function guardTenantModuleLayout(tenantSlug: string, required: TenantNavKey) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/${tenantSlug}`);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      slug: true,
      name: true,
      settings: { select: MODULE_SETTINGS_SELECT },
    },
  });
  if (!tenant) notFound();

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true, status: true, modulePermissions: true },
  });

  assertTenantNavAccess(session, membership, tenant.settings, required);

  return { session, tenant, membership };
}
