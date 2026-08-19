import { auth } from "@/auth";
import { PropertyClientStatus } from "@/generated/prisma";
import { assertTenantNavAccess, MEMBERSHIP_FOR_NAV_SELECT } from "@/lib/guard-tenant-nav";
import { canManageClients } from "@/lib/clients-access";
import { batchResolveClientPortalStatus, type ClientPortalStatus } from "@/lib/client-portal-invite";
import prisma from "@/lib/db";
import { paginate, parsePage } from "@/lib/pagination";
import { loadClientDepositRows, summarizeClientDeposits } from "@/lib/client-deposits";
import { countImportableUnlinkedUnits } from "@/lib/unit-label-client-import";
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
  searchParams: Promise<{ tab?: string; clientsPage?: string; projectId?: string }>;
}) {
  const { tenantSlug } = await params;
  const query = await searchParams;
  const { tab: tabRaw, clientsPage } = query;
  const projectIdRaw = String(query.projectId || "").trim();
  const unlinkedOnly = projectIdRaw === "none";
  const projectId = unlinkedOnly ? "" : projectIdRaw;
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
    select: MEMBERSHIP_FOR_NAV_SELECT,
  });
  assertTenantNavAccess(session, membership, tenant.settings, "clients");

  const clientWhere = {
    tenantId: tenant.id,
    ...(unlinkedOnly ? { unitLinks: { none: {} } } : {}),
    ...(projectId ? { unitLinks: { some: { unit: { projectId } } } } : {}),
  };
  const unitLinkWhere = {
    tenantId: tenant.id,
    ...(projectId ? { unit: { projectId } } : {}),
  };

  const [totalClients, activeClients, totalUnitLinks, unlinkedUnits, documents, documentClients, projects] =
    await Promise.all([
    prisma.propertyClient.count({ where: clientWhere }),
    prisma.propertyClient.count({
      where: { ...clientWhere, status: PropertyClientStatus.ACTIVE },
    }),
    unlinkedOnly ? Promise.resolve(0) : prisma.clientUnitLink.count({ where: unitLinkWhere }),
    prisma.unit.findMany({
      where: { tenantId: tenant.id, clientLinks: { none: {} } },
      select: { label: true, project: { select: { name: true } } },
      take: 2000,
    }),
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
    prisma.project.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 400,
    }),
  ]);
  const pagination = paginate(totalClients, parsePage(clientsPage), CLIENTS_PAGE_SIZE);
  const clients = await prisma.propertyClient.findMany({
    where: clientWhere,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: pagination.skip,
    take: pagination.pageSize,
    include: {
      _count: { select: { unitLinks: true, documents: true } },
      unitLinks: {
        select: {
          unit: {
            select: {
              project: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  const portalStatusByClient = await batchResolveClientPortalStatus(
    tenant.id,
    clients.map((c) => ({ id: c.id, email: c.email, userId: c.userId })),
  );
  const depositRows = await loadClientDepositRows(tenant.id);
  const scopedDepositRows = unlinkedOnly
    ? []
    : projectId
      ? depositRows.filter((row) => row.projectId === projectId)
      : depositRows;
  const depositsByClient = new Map<string, ReturnType<typeof summarizeClientDeposits>>();
  for (const row of scopedDepositRows) {
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
  const selectedProjectName = unlinkedOnly
    ? "No project linked"
    : projects.find((project) => project.id === projectId)?.name || "";

  return (
    <ClientsWorkspace
      tenantSlug={tenant.slug}
      companyName={tenant.name}
      currency={tenant.defaultCurrency || "NGN"}
      canManage={canManageClients(Boolean(session.user.isPlatformAdmin), membership)}
      unitBalances={scopedDepositRows.map((row) => ({
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
      projectOptions={projects}
      selectedProjectId={projectIdRaw}
      selectedProjectName={selectedProjectName}
      clientStats={{ active: activeClients, totalUnits: totalUnitLinks }}
      namedUnlinkedUnitsCount={countImportableUnlinkedUnits(
        unlinkedUnits.map((unit) => ({ label: unit.label, projectName: unit.project.name })),
      )}
      clients={clients.map((c) => {
        const money = depositsByClient.get(c.id);
        const projectMap = new Map<string, { id: string; name: string }>();
        for (const link of c.unitLinks) {
          projectMap.set(link.unit.project.id, {
            id: link.unit.project.id,
            name: link.unit.project.name,
          });
        }
        const clientProjects = Array.from(projectMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        const unitsCount = projectId
          ? c.unitLinks.filter((link) => link.unit.project.id === projectId).length
          : c._count.unitLinks;
        return {
          id: c.id,
          fullName: c.fullName,
          email: c.email ?? "",
          phone: c.phone ?? "",
          status: formatEnumLabel(c.status),
          statusValue: c.status,
          projects: clientProjects,
          unitsCount,
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
