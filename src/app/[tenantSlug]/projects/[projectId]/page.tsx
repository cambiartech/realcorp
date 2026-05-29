import { auth } from "@/auth";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { formatEnumLabel, formatUnitPurpose } from "@/lib/ui-format";
import { resolveTenantCurrencies } from "@/lib/finance-catalog";
import { suggestUnitLabels } from "@/lib/unit-label-suggestions";
import { notFound } from "next/navigation";
import { ProjectUnitsWorkspace } from "./project-units-workspace";

export const dynamic = "force-dynamic";

export default async function ProjectUnitsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; projectId: string }>;
}) {
  const { tenantSlug, projectId } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      slug: true,
      defaultCurrency: true,
      settings: {
        select: {
          moduleSales: true,
          moduleFinance: true,
          moduleMarketing: true,
          moduleCommunity: true,
          roleModuleGrants: true,
          financeCurrencies: true,
        },
      },
    },
  });
  if (!tenant) notFound();

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true, status: true },
  });
  assertTenantNavAccess(session, membership, tenant.settings, "projects");
  const canManage =
    session.user.isPlatformAdmin ||
    (membership?.status === MembershipStatus.ACTIVE &&
      (membership.role === MembershipRole.ORG_ADMIN || membership.role === MembershipRole.SALES_MANAGER));

  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: tenant.id },
    select: {
      id: true,
      name: true,
      units: {
        orderBy: { createdAt: "desc" },
        take: 400,
        select: {
          id: true,
          label: true,
          purpose: true,
          unitType: true,
          status: true,
          pricingPlanId: true,
          pricingPlan: { select: { name: true } },
          deal: { select: { id: true } },
        },
      },
      pricingPlans: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          name: true,
          price: true,
          currency: true,
          initialDeposit: true,
          paymentDurationMonths: true,
          _count: { select: { units: true } },
        },
      },
    },
  });
  if (!project) notFound();
  const suggestedLabels = suggestUnitLabels(
    project.name,
    project.units.map((unit) => unit.label),
  );

  const currencies = resolveTenantCurrencies(tenant.settings, tenant.defaultCurrency);

  return (
    <ProjectUnitsWorkspace
      tenantSlug={tenant.slug}
      projectId={project.id}
      projectName={project.name}
      canManage={canManage}
      currencies={currencies}
      defaultCurrency={tenant.defaultCurrency || currencies[0] || "NGN"}
      suggestedLabels={suggestedLabels}
      units={project.units.map((unit) => ({
        id: unit.id,
        label: unit.label,
        purpose: formatUnitPurpose(unit.purpose),
        purposeValue: unit.purpose,
        unitType: unit.unitType ?? "Unspecified",
        status: formatEnumLabel(unit.status),
        statusValue: unit.status,
        pricingPlanId: unit.pricingPlanId,
        pricingPlanName: unit.pricingPlan?.name ?? "No plan",
        canDelete:
          !unit.deal?.id && unit.status !== "RESERVED" && unit.status !== "SOLD",
        canReserve: !unit.deal?.id && unit.status === "AVAILABLE",
        canUnreserve: unit.status === "RESERVED",
      }))}
      pricingPlans={project.pricingPlans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        price: Number(plan.price),
        currency: plan.currency,
        initialDeposit: plan.initialDeposit ? Number(plan.initialDeposit) : null,
        paymentDurationMonths: plan.paymentDurationMonths ?? null,
        unitsCount: plan._count.units,
      }))}
    />
  );
}
