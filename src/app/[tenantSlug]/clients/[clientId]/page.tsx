import { auth } from "@/auth";
import { assertTenantNavAccess, MEMBERSHIP_FOR_NAV_SELECT } from "@/lib/guard-tenant-nav";
import { canManageClients } from "@/lib/clients-access";
import prisma from "@/lib/db";
import { loadClientDepositRows, summarizeClientDeposits } from "@/lib/client-deposits";
import { formatEnumLabel } from "@/lib/ui-format";
import { notFound } from "next/navigation";
import { ClientDetailWorkspace } from "./client-detail-workspace";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; clientId: string }>;
}) {
  const { tenantSlug, clientId } = await params;
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

  const moduleShortLets = Boolean(tenant.settings?.moduleShortLets);

  const client = await prisma.propertyClient.findFirst({
    where: { id: clientId, tenantId: tenant.id },
    include: {
      unitLinks: {
        include: {
          unit: { select: { label: true, project: { select: { name: true } } } },
          pricingPlan: { select: { name: true } },
        },
      },
      shortletLinks: {
        include: {
          shortletUnit: {
            select: {
              name: true,
              location: true,
              nightlyRate: true,
              currency: true,
              property: { select: { name: true } },
            },
          },
        },
      },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!client) notFound();

  const [projects, linkedUnitIds, linkedShortletIds, shortletProperties, standaloneShortlets, depositRows, payments] =
    await Promise.all([
      prisma.project.findMany({
        where: { tenantId: tenant.id },
        select: {
          id: true,
          name: true,
          units: {
            select: {
              id: true,
              label: true,
              pricingPlanId: true,
              pricingPlan: { select: { name: true } },
            },
            orderBy: { label: "asc" },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.clientUnitLink.findMany({
        where: { tenantId: tenant.id, clientId: client.id },
        select: { unitId: true },
      }),
      moduleShortLets
        ? prisma.clientShortletLink.findMany({
            where: { tenantId: tenant.id, clientId: client.id },
            select: { shortletUnitId: true },
          })
        : Promise.resolve([]),
      moduleShortLets
        ? prisma.shortletProperty.findMany({
            where: { tenantId: tenant.id, isActive: true },
            select: {
              id: true,
              name: true,
              units: {
                where: { isActive: true },
                select: {
                  id: true,
                  name: true,
                  location: true,
                  nightlyRate: true,
                  currency: true,
                },
                orderBy: { name: "asc" },
              },
            },
            orderBy: { sortOrder: "asc" },
          })
        : Promise.resolve([]),
      moduleShortLets
        ? prisma.shortletUnit.findMany({
            where: { tenantId: tenant.id, propertyId: null, isActive: true },
            select: {
              id: true,
              name: true,
              location: true,
              nightlyRate: true,
              currency: true,
            },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
      loadClientDepositRows(tenant.id, { clientId: client.id }),
      prisma.paymentRecord.findMany({
        where: {
          tenantId: tenant.id,
          voidedAt: null,
          OR: [
            { propertyClientId: client.id },
            { invoice: { deal: { propertyClient: { id: client.id } } } },
            { unitId: { in: client.unitLinks.map((link) => link.unitId) } },
          ],
        },
        orderBy: { paidAt: "desc" },
        take: 50,
        select: {
          id: true,
          amount: true,
          currency: true,
          paidAt: true,
          method: true,
          reference: true,
          standaloneTitle: true,
          incomeType: true,
          unit: { select: { label: true, project: { select: { name: true } } } },
        },
      }),
    ]);

  const alreadyLinkedUnits = new Set(linkedUnitIds.map((l) => l.unitId));
  const alreadyLinkedShortlets = new Set(linkedShortletIds.map((l) => l.shortletUnitId));

  const projectOptions = projects
    .map((project) => ({
      id: project.id,
      name: project.name,
      units: project.units
        .filter((u) => !alreadyLinkedUnits.has(u.id))
        .map((u) => ({
          id: u.id,
          label: u.label,
          defaultPricingPlanName: u.pricingPlan?.name ?? null,
        })),
    }))
    .filter((p) => p.units.length > 0);

  const shortletPropertyOptions = [
    ...shortletProperties
      .map((property) => ({
        id: property.id,
        name: property.name,
        units: property.units
          .filter((u) => !alreadyLinkedShortlets.has(u.id))
          .map((u) => ({
            id: u.id,
            name: u.name,
            location: u.location ?? "",
            nightlyRate: u.nightlyRate.toString(),
            currency: u.currency,
          })),
      }))
      .filter((p) => p.units.length > 0),
    ...(standaloneShortlets.filter((u) => !alreadyLinkedShortlets.has(u.id)).length > 0
      ? [
          {
            id: "__standalone__",
            name: "Standalone apartments",
            units: standaloneShortlets
              .filter((u) => !alreadyLinkedShortlets.has(u.id))
              .map((u) => ({
                id: u.id,
                name: u.name,
                location: u.location ?? "",
                nightlyRate: u.nightlyRate.toString(),
                currency: u.currency,
              })),
          },
        ]
      : []),
  ];

  const depositSummary = summarizeClientDeposits(depositRows);
  const paymentUnitOptions = projects.flatMap((project) =>
    project.units.map((unit) => ({
      id: unit.id,
      label: `${project.name} · ${unit.label}`,
    })),
  );

  return (
    <ClientDetailWorkspace
      tenantSlug={tenant.slug}
      companyName={tenant.name}
      currency={tenant.defaultCurrency || "NGN"}
      canManage={canManageClients(Boolean(session.user.isPlatformAdmin), membership)}
      moduleShortLets={moduleShortLets}
      client={{
        id: client.id,
        fullName: client.fullName,
        email: client.email ?? "",
        phone: client.phone ?? "",
        alternatePhone: client.alternatePhone ?? "",
        addressLine: client.addressLine ?? "",
        city: client.city ?? "",
        state: client.state ?? "",
        country: client.country ?? "",
        status: formatEnumLabel(client.status),
        statusValue: client.status,
        notes: client.notes ?? "",
      }}
      depositSummary={depositSummary}
      depositRows={depositRows.map((row) => ({
        id: row.id,
        projectLabel: row.projectLabel,
        unitLabel: row.unitLabel,
        contractValue: row.contractValue,
        collected: row.collected,
        remaining: row.remaining,
      }))}
      payments={payments.map((payment) => ({
        id: payment.id,
        title: payment.standaloneTitle || "Client deposit",
        unitLabel: payment.unit
          ? `${payment.unit.project.name} · ${payment.unit.label}`
          : "Unassigned unit",
        amount: Number(payment.amount),
        currency: payment.currency,
        paidAtLabel: payment.paidAt.toISOString().slice(0, 10),
        method: payment.method ?? "",
        reference: payment.reference ?? "",
      }))}
      paymentUnitOptions={paymentUnitOptions}
      unitLinks={client.unitLinks.map((link) => ({
        id: link.id,
        unitLabel: link.unit.label,
        projectName: link.unit.project.name,
        pricingPlanName: link.pricingPlan?.name ?? "No plan",
        role: formatEnumLabel(link.role),
        roleValue: link.role,
      }))}
      shortletLinks={client.shortletLinks.map((link) => ({
        id: link.id,
        unitName: link.shortletUnit.name,
        propertyName: link.shortletUnit.property?.name ?? link.shortletUnit.location ?? "Standalone",
        nightlyRateLabel: `${link.shortletUnit.currency} ${Number(link.shortletUnit.nightlyRate).toLocaleString()}/night`,
        role: formatEnumLabel(link.role),
        roleValue: link.role,
      }))}
      projectOptions={projectOptions}
      shortletPropertyOptions={shortletPropertyOptions}
      documents={client.documents.map((doc) => ({
        id: doc.id,
        clientId: client.id,
        clientName: client.fullName,
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
