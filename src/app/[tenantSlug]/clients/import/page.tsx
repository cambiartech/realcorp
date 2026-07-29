import { auth } from "@/auth";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import { canManageClients } from "@/lib/clients-access";
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { ClientImportWorkspace } from "./import-workspace";

export const dynamic = "force-dynamic";

export default async function ClientImportPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
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
          moduleShortLets: true,
          moduleHr: true,
          moduleTasks: true,
          moduleClients: true,
          roleModuleGrants: true,
        },
      },
    },
  });
  if (!tenant) notFound();

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true, status: true },
  });
  assertTenantNavAccess(session, membership, tenant.settings, "clients");
  if (!canManageClients(Boolean(session.user.isPlatformAdmin), membership)) notFound();

  return <ClientImportWorkspace tenantSlug={tenant.slug} />;
}
