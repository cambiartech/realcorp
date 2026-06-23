import { auth } from "@/auth";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import { canManageClients } from "@/lib/clients-access";
import { batchResolveClientPortalStatus, type ClientPortalStatus } from "@/lib/client-portal-invite";
import prisma from "@/lib/db";
import { formatEnumLabel } from "@/lib/ui-format";
import { notFound } from "next/navigation";
import { ClientsWorkspace } from "./clients-workspace";

export const dynamic = "force-dynamic";

function parseTab(tab?: string): "clients" | "documents" {
  return tab === "documents" ? "documents" : "clients";
}

export default async function ClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tenantSlug } = await params;
  const { tab: tabRaw } = await searchParams;
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

  const [clients, documents] = await Promise.all([
    prisma.propertyClient.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { unitLinks: true, documents: true } },
      },
      take: 500,
    }),
    prisma.clientDocument.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "desc" },
      include: { client: { select: { id: true, fullName: true } } },
      take: 500,
    }),
  ]);

  const portalStatusByClient = await batchResolveClientPortalStatus(
    tenant.id,
    clients.map((c) => ({ id: c.id, email: c.email, userId: c.userId })),
  );

  return (
    <ClientsWorkspace
      tenantSlug={tenant.slug}
      canManage={canManageClients(Boolean(session.user.isPlatformAdmin), membership)}
      activeTab={parseTab(tabRaw)}
      clients={clients.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        email: c.email ?? "",
        phone: c.phone ?? "",
        status: formatEnumLabel(c.status),
        statusValue: c.status,
        unitsCount: c._count.unitLinks,
        documentsCount: c._count.documents,
        createdAtLabel: c.createdAt.toISOString().slice(0, 10),
        portalStatus: portalStatusByClient.get(c.id) ?? ("none" as ClientPortalStatus),
      }))}
      documentClients={clients.map((c) => ({ id: c.id, fullName: c.fullName }))}
      documents={documents.map((doc) => ({
        id: doc.id,
        clientId: doc.clientId,
        clientName: doc.client.fullName,
        category: formatEnumLabel(doc.category),
        categoryValue: doc.category,
        title: doc.title,
        fileUrl: doc.fileUrl,
        fileName: doc.fileName ?? doc.title,
        uploadedAtLabel: doc.createdAt.toISOString().slice(0, 10),
        visibleInPortal: doc.visibleInPortal,
      }))}
    />
  );
}
