import { cache } from "react";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import { buildOrgSetupSteps, orgSetupProgress } from "@/lib/org-setup-checklist";

type MembershipSlice = { role: MembershipRole; status: MembershipStatus } | null | undefined;

type TenantSetupSlice = {
  slug: string;
  name: string;
  defaultCurrency: string;
  settings: {
    moduleFinance?: boolean | null;
    logoUrl?: string | null;
    orgEmail?: string | null;
    orgPhone?: string | null;
    financeCurrencies?: unknown;
    financeBankAccounts?: unknown;
    financePaymentModes?: unknown;
  } | null;
};

export const loadOrgSetupForUser = cache(async function loadOrgSetupForUser(
  tenantId: string,
  userId: string,
  isPlatformAdmin: boolean,
  membership?: MembershipSlice,
  preloadedTenant?: TenantSetupSlice | null,
) {
  const resolved =
    membership === undefined
      ? await prisma.membership.findUnique({
          where: { tenantId_userId: { tenantId, userId } },
          select: { role: true, status: true },
        })
      : membership;

  const canManageOrgSetup =
    isPlatformAdmin ||
    (resolved?.status === MembershipStatus.ACTIVE && resolved.role === MembershipRole.ORG_ADMIN);

  if (!canManageOrgSetup) {
    return { canManageOrgSetup: false as const };
  }

  const [tenant, goal, activeMemberCount, pendingInviteCount] = await Promise.all([
    preloadedTenant
      ? Promise.resolve(preloadedTenant)
      : prisma.tenant.findUnique({
          where: { id: tenantId },
          select: {
            slug: true,
            name: true,
            defaultCurrency: true,
            settings: {
              select: {
                moduleFinance: true,
                logoUrl: true,
                orgEmail: true,
                orgPhone: true,
                financeCurrencies: true,
                financeBankAccounts: true,
                financePaymentModes: true,
              },
            },
          },
        }),
    prisma.tenantGoal.findFirst({
      where: { tenantId, isActive: true },
      select: { id: true },
    }),
    prisma.membership.count({
      where: { tenantId, status: MembershipStatus.ACTIVE },
    }),
    prisma.invitation.count({
      where: { tenantId, acceptedAt: null, expiresAt: { gt: new Date() } },
    }),
  ]);

  if (!tenant) {
    return { canManageOrgSetup: false as const };
  }

  const steps = buildOrgSetupSteps({
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    defaultCurrency: tenant.defaultCurrency || "NGN",
    logoUrl: tenant.settings?.logoUrl ?? null,
    orgEmail: tenant.settings?.orgEmail ?? null,
    orgPhone: tenant.settings?.orgPhone ?? null,
    financeCurrencies: tenant.settings?.financeCurrencies,
    financeBankAccounts: tenant.settings?.financeBankAccounts,
    financePaymentModes: tenant.settings?.financePaymentModes,
    moduleFinance: tenant.settings?.moduleFinance ?? true,
    activeMemberCount,
    pendingInviteCount,
    hasActiveFiscalGoal: Boolean(goal),
  });

  const progress = orgSetupProgress(steps);

  return {
    canManageOrgSetup: true as const,
    tenantSlug: tenant.slug,
    steps,
    criticalComplete: progress.criticalComplete,
    percent: progress.percent,
    allComplete: progress.completed === progress.total,
  };
});
