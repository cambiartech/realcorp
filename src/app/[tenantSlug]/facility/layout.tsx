import { redirectToLogin } from "@/lib/login-redirect";
import { loadTenantRequest } from "@/lib/tenant-request";
import { canViewFacilityModule } from "@/lib/facility-access";
import { normalizeSettingsNavSlice } from "@/lib/tenant-nav-access";
import { redirect } from "next/navigation";

export default async function FacilityLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { session, tenant, membership } = await loadTenantRequest(tenantSlug);
  if (!session?.user?.id) {
    await redirectToLogin(`/${tenantSlug}/facility`);
  }
  if (!tenant) redirect(`/${tenantSlug}`);
  const settingsNav = normalizeSettingsNavSlice(tenant.settings);
  if (
    !canViewFacilityModule({
      isPlatformAdmin: Boolean(session.user.isPlatformAdmin),
      membership,
      moduleFacility: Boolean(settingsNav.moduleFacility),
    })
  ) {
    redirect(`/${tenantSlug}`);
  }

  return (
    <div className="w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      {children}
    </div>
  );
}
