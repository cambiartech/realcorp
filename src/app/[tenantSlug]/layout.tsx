import { notFound, redirect } from "next/navigation";
import { TenantAppHeaderBrand } from "@/components/realcorp-brand";
import { TenantHeaderActions } from "@/components/tenant-header-actions";
import { TenantMobileDock, TenantSidebar } from "@/components/tenant-nav";
import { canManageHr } from "@/lib/hr-access";
import { getVisibleNavKeys, normalizeSettingsNavSlice } from "@/lib/tenant-nav-access";
import { parseMembershipModulePermissions } from "@/lib/membership-module-permissions";
import { resolveShortletsAccess } from "@/lib/shortlets-access";
import { loadOrgSetupForUser } from "@/lib/load-org-setup";
import { OrgSetupCoachBoundary } from "@/components/org-setup-coach-boundary";
import { loadTenantRequest } from "@/lib/tenant-request";
import prisma from "@/lib/db";
import { cache } from "react";

const getHrProfileId = cache(async (tenantId: string, userId: string) =>
  prisma.employeeProfile.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
    select: { id: true },
  }),
);

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { session, tenant, membership } = await loadTenantRequest(tenantSlug);

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/${tenantSlug}`);
  }

  if (!tenant) {
    notFound();
  }

  const allowed = session.user.isPlatformAdmin || (membership && membership.status === "ACTIVE");
  if (!allowed) {
    redirect("/");
  }

  const settingsNav = normalizeSettingsNavSlice(tenant.settings);
  const visibleNavKeys = getVisibleNavKeys({
    role: membership?.role,
    isPlatformAdmin: Boolean(session.user.isPlatformAdmin),
    membershipStatus: membership?.status,
    settings: settingsNav,
    userModulePermissions: parseMembershipModulePermissions(membership?.modulePermissions),
  });

  const userLabel = session.user.name || session.user.email || "Signed in";
  const manageHr = canManageHr(Boolean(session.user.isPlatformAdmin), membership);
  const hrEmployeeProfile = manageHr ? await getHrProfileId(tenant.id, session.user.id) : null;

  const orgSetup = await loadOrgSetupForUser(
    tenant.id,
    session.user.id,
    Boolean(session.user.isPlatformAdmin),
    membership,
    tenant,
  );

  const shortletsAccess = visibleNavKeys.includes("shortlets")
    ? resolveShortletsAccess({
        isPlatformAdmin: Boolean(session.user.isPlatformAdmin),
        membership: membership
          ? {
              status: membership.status,
              role: membership.role,
              modulePermissions: membership.modulePermissions,
            }
          : null,
      })
    : null;

  const navProps = {
    tenantName: tenant.name,
    tenantSlug: tenant.slug,
    tenantLogoUrl: tenant.settings?.logoUrl ?? null,
    canAccessPlatform: Boolean(session.user.isPlatformAdmin),
    canManageHr: manageHr,
    hasHrEmployeeProfile: Boolean(hrEmployeeProfile),
    visibleNavKeys,
    moduleWhatsApp: tenant.settings?.moduleWhatsApp !== false,
    userName: session.user.name ?? null,
    userEmail: session.user.email ?? null,
    shortletsAccess,
  };

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b border-foreground/10 bg-background">
        <div className="flex w-full items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <TenantAppHeaderBrand tenantSlug={tenant.slug} tenantName={tenant.name} />
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted md:hidden">Tenant app</p>
            <TenantHeaderActions tenantSlug={tenant.slug} userLabel={userLabel} />
          </div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 w-full items-stretch overflow-hidden">
        <TenantSidebar {...navProps} />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain pb-28 md:pb-24">
          {children}
        </main>
      </div>
      {orgSetup.canManageOrgSetup && !orgSetup.allComplete ? (
        <OrgSetupCoachBoundary
          tenantSlug={orgSetup.tenantSlug}
          userId={session.user.id}
          tenantName={tenant.name}
          steps={orgSetup.steps}
        />
      ) : null}
      <TenantMobileDock
        tenantSlug={tenant.slug}
        canAccessPlatform={Boolean(session.user.isPlatformAdmin)}
        visibleNavKeys={visibleNavKeys}
      />
    </div>
  );
}
