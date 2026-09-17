import { redirectToLogin } from "@/lib/login-redirect";
import { loadTenantRequest } from "@/lib/tenant-request";
import { canViewInventoryModule } from "@/lib/inventory-access";
import { normalizeSettingsNavSlice } from "@/lib/tenant-nav-access";
import { redirect } from "next/navigation";

export default async function InventoryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { session, tenant, membership } = await loadTenantRequest(tenantSlug);
  if (!session?.user?.id) {
    await redirectToLogin(`/${tenantSlug}/inventory`);
  }
  if (!tenant) redirect(`/${tenantSlug}`);
  const settingsNav = normalizeSettingsNavSlice(tenant.settings);
  if (
    !canViewInventoryModule({
      isPlatformAdmin: Boolean(session.user.isPlatformAdmin),
      membership,
      moduleInventory: Boolean(settingsNav.moduleInventory),
    })
  ) {
    redirect(`/${tenantSlug}`);
  }

  return <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-5">{children}</div>;
}
