import { auth } from "@/auth";
import { canManageHr } from "@/lib/hr-access";
import { assertTenantNavAccess, MEMBERSHIP_FOR_NAV_SELECT } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { mergeOrgDepartments } from "@/lib/org-departments";
import { parsePensionAdministrators } from "@/lib/org-pension-administrators";
import { parseOrgPayrollSettings } from "@/lib/payroll/org-payroll-settings";
import { notFound } from "next/navigation";
import { HrPeopleSettingsWorkspace } from "@/components/hr/hr-people-settings";

export const dynamic = "force-dynamic";

export default async function HrPeopleSettingsPage({
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
      settings: {
        select: {
          payrollCountryCode: true,
          payrollSettings: true,
          orgDepartments: true,
          pensionAdministrators: true,
          moduleSales: true,
          moduleFinance: true,
          moduleMarketing: true,
          moduleCommunity: true,
          moduleShortLets: true,
          moduleHr: true,
          moduleFacility: true,
          moduleTasks: true,
          moduleClients: true,
          moduleListings: true,
          moduleInvestorPortal: true,
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

  assertTenantNavAccess(session, membership, tenant.settings, "hr");
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) notFound();

  return (
    <HrPeopleSettingsWorkspace
      tenantSlug={tenant.slug}
      payroll={parseOrgPayrollSettings(
        tenant.settings?.payrollCountryCode,
        tenant.settings?.payrollSettings,
      )}
      orgDepartments={mergeOrgDepartments(tenant.settings?.orgDepartments as string[] | null | undefined)}
      pensionAdministrators={parsePensionAdministrators(tenant.settings?.pensionAdministrators)}
    />
  );
}
