import { redirect } from "next/navigation";
import { canViewHrModule } from "@/lib/hr-access";
import { redirectToLogin } from "@/lib/login-redirect";
import { normalizeSettingsNavSlice } from "@/lib/tenant-nav-access";
import { loadTenantRequest } from "@/lib/tenant-request";

export default async function HrLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { session, tenant, membership } = await loadTenantRequest(tenantSlug);
  if (!session?.user?.id) {
    await redirectToLogin(`/${tenantSlug}/hr`);
  }
  if (!tenant) {
    redirect(`/${tenantSlug}`);
  }

  const settingsNav = normalizeSettingsNavSlice(tenant.settings);
  if (!canViewHrModule(Boolean(session.user.isPlatformAdmin), membership, settingsNav.moduleHr)) {
    redirect(`/${tenantSlug}`);
  }

  return children;
}
