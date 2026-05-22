import { auth } from "@/auth";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import { mergeCurrencyOptions, normalizeFinanceOptionList } from "@/lib/finance-catalog";
import { parseFinanceControls } from "@/lib/finance-controls";
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { FinanceSettingsWorkspace } from "./settings-workspace";

export const dynamic = "force-dynamic";
const DEFAULT_PAYMENT_MODES = ["Bank Transfer", "Cash", "Cheque", "POS"];

function canManageFinance(
  isPlatformAdmin: boolean,
  membership: { status: MembershipStatus; role: MembershipRole } | null,
) {
  if (isPlatformAdmin) return true;
  if (!membership || membership.status !== MembershipStatus.ACTIVE) return false;
  return membership.role === MembershipRole.ORG_ADMIN || membership.role === MembershipRole.FINANCE_MANAGER;
}

export default async function FinanceSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      slug: true,
      defaultCurrency: true,
      settings: {
        select: {
          moduleSales: true,
          moduleFinance: true,
          moduleMarketing: true,
          moduleCommunity: true,
          roleModuleGrants: true,
          financeBankAccounts: true,
          financePaymentModes: true,
          financeCurrencies: true,
          financeControls: true,
        },
      },
    },
  });
  if (!tenant) notFound();

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { status: true, role: true },
  });

  assertTenantNavAccess(session, membership, tenant.settings, "finance");

  if (!canManageFinance(Boolean(session.user.isPlatformAdmin), membership)) notFound();

  const savedBanks = normalizeFinanceOptionList(tenant.settings?.financeBankAccounts);
  const savedModes = normalizeFinanceOptionList(tenant.settings?.financePaymentModes);
  const mergedModes =
    savedModes.length > 0 ? Array.from(new Set([...DEFAULT_PAYMENT_MODES, ...savedModes])) : DEFAULT_PAYMENT_MODES;
  const currenciesMerged = mergeCurrencyOptions(tenant.settings?.financeCurrencies, tenant.defaultCurrency || "NGN");

  const defaults = {
    financeBankAccounts: savedBanks,
    financePaymentModes: mergedModes,
    financeCurrencies: currenciesMerged,
    financeControls: parseFinanceControls(tenant.settings?.financeControls),
  };

  return <FinanceSettingsWorkspace tenantSlug={tenant.slug} defaults={defaults} />;
}
