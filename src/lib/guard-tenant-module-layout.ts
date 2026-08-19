import { notFound } from "next/navigation";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import { redirectToLogin } from "@/lib/login-redirect";
import type { TenantNavKey } from "@/lib/tenant-nav-access";
import { loadTenantRequest } from "@/lib/tenant-request";

/** Shared layout guard: auth + module entitlement + role nav access. */
export async function guardTenantModuleLayout(tenantSlug: string, required: TenantNavKey) {
  const { session, tenant, membership } = await loadTenantRequest(tenantSlug);
  if (!session?.user?.id) {
    await redirectToLogin(`/${tenantSlug}`);
  }
  if (!tenant) notFound();

  assertTenantNavAccess(session, membership, tenant.settings, required);

  return { session, tenant, membership };
}
