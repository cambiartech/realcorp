import { auth } from "@/auth";
import { assertTenantNavAccess, MEMBERSHIP_FOR_NAV_SELECT } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { loadShortletIncomeReport } from "@/lib/shortlet-income-report";
import { notFound } from "next/navigation";
import { ShortletsIncomeWorkspace } from "./shortlets-income-workspace";

export const dynamic = "force-dynamic";

export default async function FinanceShortletsIncomePage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
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
  assertTenantNavAccess(session, membership, tenant.settings, "finance");

  const report = await loadShortletIncomeReport(tenant.id);

  return (
    <ShortletsIncomeWorkspace
      tenantSlug={tenant.slug}
      companyName={tenant.name}
      currency={tenant.defaultCurrency || "NGN"}
      report={report}
    />
  );
}
