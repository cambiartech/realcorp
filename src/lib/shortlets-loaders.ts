import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import { resolveTenantCurrencies } from "@/lib/finance-catalog";
import { parseShortletPmsSettings } from "@/lib/shortlets-settings";
import {
  canAccessShortLets,
  resolveShortletsAccess,
  type ShortletsAccessContext,
} from "@/lib/shortlets-access";
import { loadTenantRequest } from "@/lib/tenant-request";
import { notFound } from "next/navigation";

export async function loadShortletsContext(tenantSlug: string) {
  const { session, tenant, membership } = await loadTenantRequest(tenantSlug);
  if (!session?.user?.id) notFound();
  if (!tenant) notFound();

  assertTenantNavAccess(session, membership, tenant.settings, "shortlets");

  const accessCtx: ShortletsAccessContext = {
    isPlatformAdmin: Boolean(session.user.isPlatformAdmin),
    membership,
  };
  if (!canAccessShortLets(accessCtx)) notFound();

  const pmsSettings = parseShortletPmsSettings(tenant.settings);
  const currencies = resolveTenantCurrencies(tenant.settings, tenant.defaultCurrency);

  return {
    session,
    tenant,
    membership,
    moduleClients: tenant.settings?.moduleClients ?? false,
    access: resolveShortletsAccess(accessCtx),
    pmsSettings,
    currencies,
  };
}

export function revalidateShortletsPaths(tenantSlug: string) {
  const base = `/${tenantSlug}/shortlets`;
  return [
    base,
    `${base}/front-desk`,
    `${base}/rooms`,
    `${base}/reservations`,
    `${base}/reservations/new`,
    `${base}/locations`,
    `${base}/apartments`,
    `${base}/guests`,
    `${base}/guests/new`,
    `${base}/inspections`,
    `${base}/folio`,
    `${base}/channels`,
    `${base}/reports`,
    `${base}/settings`,
  ];
}
