import { OrgChartView } from "@/components/hr/org-chart-view";
import { PageHeader } from "@/components/page-header";
import { TenantPageShell } from "@/components/tenant-page-shell";
import { EmployeeProfileStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import { canManageHr, canViewHrModule } from "@/lib/hr-access";
import { personalOrgView, type OrgPerson } from "@/lib/org-chart";
import { redirectToLogin } from "@/lib/login-redirect";
import { normalizeSettingsNavSlice } from "@/lib/tenant-nav-access";
import { loadTenantRequest } from "@/lib/tenant-request";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HrOrgChartPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { session, tenant, membership } = await loadTenantRequest(tenantSlug);
  if (!session?.user?.id) await redirectToLogin(`/${tenantSlug}/hr/org`);
  if (!tenant) notFound();

  const settingsNav = normalizeSettingsNavSlice(tenant.settings);
  if (!canViewHrModule(Boolean(session.user.isPlatformAdmin), membership, settingsNav.moduleHr)) {
    redirect(`/${tenantSlug}`);
  }

  const manageHr = canManageHr(Boolean(session.user.isPlatformAdmin), membership);
  const profiles = await prisma.employeeProfile.findMany({
    where: {
      tenantId: tenant.id,
      status: { in: [EmployeeProfileStatus.ACTIVE, EmployeeProfileStatus.DRAFT] },
    },
    select: {
      userId: true,
      fullName: true,
      position: true,
      department: true,
      photoUrl: true,
      reportsToUserId: true,
      reportingToLabel: true,
      workEmail: true,
    },
    orderBy: { fullName: "asc" },
    take: 500,
  });

  const people: OrgPerson[] = profiles.map((profile) => ({
    userId: profile.userId,
    name: profile.fullName || profile.workEmail || "Team member",
    title: profile.position,
    department: profile.department,
    photoUrl: profile.photoUrl,
    reportsToUserId: profile.reportsToUserId,
    reportingToLabel: profile.reportingToLabel,
  }));

  const line = personalOrgView(session.user.id, people);
  const companyPeople = manageHr ? people : null;

  return (
    <TenantPageShell>
      <PageHeader
        eyebrow={manageHr ? "People" : "My HR"}
        title="Org chart"
        description={
          manageHr
            ? "Company structure from each person’s Reports to. Staff only see their own line up to the top."
            : "Your place in the company — from you up to the top, and anyone who reports to you."
        }
      />
      <OrgChartView
        lineChain={line.chain}
        lineReports={line.directReports}
        focusUserId={session.user.id}
        companyPeople={companyPeople}
      />
    </TenantPageShell>
  );
}
