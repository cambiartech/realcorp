import { auth } from "@/auth";
import { PropertyClientStatus } from "@/generated/prisma";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import { canManageClients } from "@/lib/clients-access";
import { batchResolveClientPortalStatus, type ClientPortalStatus } from "@/lib/client-portal-invite";
import prisma from "@/lib/db";
import { paginate, parsePage } from "@/lib/pagination";
import { loadClientDepositRows, summarizeClientDeposits } from "@/lib/client-deposits";
import { formatEnumLabel } from "@/lib/ui-format";
import { notFound } from "next/navigation";
import { ClientsWorkspace } from "./clients-workspace";

export const dynamic = "force-dynamic";
const CLIENTS_PAGE_SIZE = 50;

function parseTab(tab?: string): "clients" | "documents" {
  return tab === "documents" ? "documents" : "clients";
}

export default async function ClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ tab?: string; clientsPage?: string }>;
}) {
  const { tenantSlug } = await params;
  const query = await searchParams;
  const { tab: tabRaw, clientsPage } = query;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      slug: true,
      name: true,
      defaultCurrency: true,
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

  const [totalClients, activeClients, totalUnitLinks, documents, documentClients] = await Promise.all([
    prisma.propertyClient.count({ where: { tenantId: tenant.id } }),
    prisma.propertyClient.count({
      where: { tenantId: tenant.id, status: PropertyClientStatus.ACTIVE },
    }),
    prisma.clientUnitLink.count({ where: { tenantId: tenant.id } }),
    prisma.clientDocument.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      include: { client: { select: { id: true, fullName: true } } },
      take: 500,
    }),
    prisma.propertyClient.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ fullName: "asc" }, { id: "asc" }],
      select: { id: true, fullName: true },
    }),
  ]);
  const pagination = paginate(totalClients, parsePage(clientsPage), CLIENTS_PAGE_SIZE);
  const clients = await prisma.propertyClient.findMany({
    where: { tenantId: tenant.id },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: pagination.skip,
    take: pagination.pageSize,
    include: {
      _count: { select: { unitLinks: true, documents: true } },
    },
  });

  const portalStatusByClient = await batchResolveClientPortalStatus(
    tenant.id,
    clients.map((c) => ({ id: c.id, email: c.email, userId: c.userId })),
  );
  const depositRows = await loadClientDepositRows(tenant.id);
  const depositsByClient = new Map<string, ReturnType<typeof summarizeClientDeposits>>();
  for (const row of depositRows) {
    const current = depositsByClient.get(row.clientId) ?? {
      contractValue: 0,
      collected: 0,
      remaining: 0,
    };
    depositsByClient.set(row.clientId, {
      contractValue: current.contractValue + row.contractValue,
      collected: current.collected + row.collected,
      remaining: current.remaining + row.remaining,
    });
  }

  return (
    <ClientsWorkspace
      tenantSlug={tenant.slug}
      companyName={tenant.name}
      currency={tenant.defaultCurrency || "NGN"}
      canManage={canManageClients(Boolean(session.user.isPlatformAdmin), membership)}
      unitBalances={depositRows.map((row) => ({
        clientName: row.clientName,
        projectLabel: row.projectLabel,
        unitLabel: row.unitLabel,
        contractValue: row.contractValue,
        collected: row.collected,
        remaining: row.remaining,
      }))}
      activeTab={parseTab(tabRaw)}
      pagination={pagination}
      paginationSearchParams={query}
      clientStats={{ active: activeClients, totalUnits: totalUnitLinks }}
      clients={clients.map((c) => {
        const money = depositsByClient.get(c.id);
        return {
          id: c.id,
          fullName: c.fullName,
          email: c.email ?? "",
          phone: c.phone ?? "",
          status: formatEnumLabel(c.status),
          statusValue: c.status,
          unitsCount: c._count.unitLinks,
          documentsCount: c._count.documents,
          paid: money?.collected ?? 0,
          remaining: money?.remaining ?? 0,
          createdAtLabel: c.createdAt.toISOString().slice(0, 10),
          portalStatus: portalStatusByClient.get(c.id) ?? ("none" as ClientPortalStatus),
        };
      })}
      documentClients={documentClients}
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
