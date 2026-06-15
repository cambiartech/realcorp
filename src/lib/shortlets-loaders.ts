import { auth } from "@/auth";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { resolveTenantCurrencies } from "@/lib/finance-catalog";
import { parseShortletPmsSettings } from "@/lib/shortlets-settings";
import {
  canAccessShortLets,
  canManageHousekeeping,
  canManageShortLets,
  canManageShortletSettings,
  canPostFolio,
  canViewShortletReports,
  type ShortletsAccessContext,
} from "@/lib/shortlets-access";
import { notFound } from "next/navigation";

const TENANT_SELECT = {
  id: true,
  slug: true,
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
      financeCurrencies: true,
      shortletCheckInTime: true,
      shortletCheckOutTime: true,
      shortletEodTime: true,
      shortletCheckoutAlertHours: true,
      shortletFinanceSync: true,
    },
  },
} as const;

export async function loadShortletsContext(tenantSlug: string) {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: TENANT_SELECT,
  });
  if (!tenant) notFound();

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { status: true, role: true },
  });

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
    access: {
      canManage: canManageShortLets(accessCtx),
      canHousekeeping: canManageHousekeeping(accessCtx),
      canPostFolio: canPostFolio(accessCtx),
      canSettings: canManageShortletSettings(accessCtx),
      canReports: canViewShortletReports(accessCtx),
    },
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
    `${base}/folio`,
    `${base}/channels`,
    `${base}/reports`,
    `${base}/settings`,
  ];
}
