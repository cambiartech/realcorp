import type { TenantModuleField } from "@/lib/tenant-module-definitions";

/** Paths to revalidate when platform admin changes module entitlements. */
export function tenantModuleRevalidatePaths(
  tenantSlug: string,
  changed?: Partial<Record<TenantModuleField, boolean>>,
) {
  const base = `/${tenantSlug}`;
  const all = [
    base,
    `${base}/settings`,
    `${base}/projects`,
    `${base}/leads`,
    `${base}/deals`,
    `${base}/activities`,
    `${base}/tasks`,
    `${base}/marketing`,
    `${base}/listings`,
    `${base}/stakeholders`,
    `${base}/community`,
    `${base}/shortlets`,
    `${base}/finance`,
    `${base}/hr`,
    `${base}/facility`,
    `${base}/clients`,
    `${base}/portal`,
    `${base}/team`,
  ];

  if (!changed) return all;

  const paths = new Set<string>([base, `${base}/settings`]);
  if (changed.moduleSales) {
    for (const p of ["projects", "leads", "deals", "activities"]) paths.add(`${base}/${p}`);
  }
  if (changed.moduleFinance) paths.add(`${base}/finance`);
  if (changed.moduleMarketing) paths.add(`${base}/marketing`);
  if (changed.moduleCommunity) paths.add(`${base}/community`);
  if (changed.moduleShortLets) paths.add(`${base}/shortlets`);
  if (changed.moduleHr) paths.add(`${base}/hr`);
  if (changed.moduleFacility) paths.add(`${base}/facility`);
  if (changed.moduleTasks) paths.add(`${base}/tasks`);
  if (changed.moduleClients) paths.add(`${base}/clients`);
  if (changed.moduleListings) paths.add(`${base}/listings`);
  if (changed.moduleInvestorPortal) {
    paths.add(`${base}/portal`);
    paths.add(`${base}/stakeholders`);
  }

  return [...paths];
}
