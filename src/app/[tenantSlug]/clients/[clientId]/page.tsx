import { auth } from "@/auth";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import { canManageClients } from "@/lib/clients-access";
import prisma from "@/lib/db";
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

  const client = await prisma.propertyClient.findFirst({
    where: { id: clientId, tenantId: tenant.id },
    include: {
      unitLinks: {
        include: {
          unit: { select: { label: true, project: { select: { name: true } } } },
          pricingPlan: { select: { name: true } },
        },
      },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!client) notFound();

  const [projects, linkedUnitIds] = await Promise.all([
    prisma.project.findMany({
      where: { tenantId: tenant.id },
      select: {
        name: true,
        units: {
          select: { id: true, label: true, pricingPlanId: true },
          orderBy: { label: "asc" },
        },
        pricingPlans: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.clientUnitLink.findMany({
      where: { tenantId: tenant.id, clientId: client.id },
      select: { unitId: true },
    }),
  ]);

  const alreadyLinked = new Set(linkedUnitIds.map((l) => l.unitId));
  const unitOptions = projects.flatMap((project) =>
    project.units
      .filter((u) => !alreadyLinked.has(u.id))
      .map((u) => ({
        id: u.id,
        label: u.label,
        projectName: project.name,
        pricingPlanId: u.pricingPlanId,
        pricingPlans: project.pricingPlans,
      })),
  );

  return (
    <ClientDetailWorkspace
      tenantSlug={tenant.slug}
      canManage={canManageClients(Boolean(session.user.isPlatformAdmin), membership)}
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
      unitLinks={client.unitLinks.map((link) => ({
        id: link.id,
        unitLabel: link.unit.label,
        projectName: link.unit.project.name,
        pricingPlanName: link.pricingPlan?.name ?? "No plan",
        role: formatEnumLabel(link.role),
        roleValue: link.role,
      }))}
      unitOptions={unitOptions}
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
      }))}
    />
  );
}
