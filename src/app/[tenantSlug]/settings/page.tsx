import { auth } from "@/auth";
import { MembershipRole } from "@/generated/prisma";
import prisma from "@/lib/db";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import { mergeOrgDepartments } from "@/lib/org-departments";
import { formatEnumLabel } from "@/lib/ui-format";
import { notFound } from "next/navigation";
import { SettingsWorkspace } from "./settings-workspace";

export const dynamic = "force-dynamic";

const settingsSelect = {
  logoUrl: true,
  primaryColor: true,
  accentColor: true,
  orgEmail: true,
  orgPhone: true,
  orgAddressLine: true,
  orgCity: true,
  orgState: true,
  orgCountry: true,
  moduleSales: true,
  moduleFinance: true,
  moduleMarketing: true,
  moduleCommunity: true,
  moduleRealtorPortal: true,
  moduleShortLets: true,
  moduleHr: true,
  moduleTasks: true,
  moduleClients: true,
  roleModuleGrants: true,
  orgDepartments: true,
  metaVerifyToken: true,
  metaPageAccessToken: true,
  metaDefaultSource: true,
  termiiApiKey: true,
  termiiSenderId: true,
  whatsappAccessToken: true,
  whatsappPhoneNumberId: true,
  whatsappVerifyToken: true,
  whatsappBotEnabled: true,
  moduleWhatsApp: true,
  moduleListings: true,
  moduleInvestorPortal: true,
  financeBankAccounts: true,
  financePaymentModes: true,
  financeCurrencies: true,
} as const;

const SETTINGS_TABS = ["profile", "organization", "modules", "integrations", "about"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

function parseSettingsTab(value: string | undefined): SettingsTab | undefined {
  if (!value) return undefined;
  return SETTINGS_TABS.includes(value as SettingsTab) ? (value as SettingsTab) : undefined;
}

export default async function TenantSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { tenantSlug } = await params;
  const sp = searchParams ? await searchParams : {};
  const session = await auth();
  if (!session?.user?.id) notFound();

  const [tenant, user] = await Promise.all([
    prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        plan: true,
        defaultCurrency: true,
        defaultTimezone: true,
        settings: { select: settingsSelect },
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    }),
  ]);
  if (!tenant) notFound();

  const membership = await prisma.membership.findUnique({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: session.user.id,
      },
    },
    select: { role: true, status: true },
  });

  assertTenantNavAccess(session, membership, tenant.settings, "settings");

  const roleLabel = session.user.isPlatformAdmin
    ? "Platform Admin"
    : formatEnumLabel(membership?.role ?? "SALES_EXECUTIVE");

  const canManageOrg =
    Boolean(session.user.isPlatformAdmin) || membership?.role === MembershipRole.ORG_ADMIN;

  const workspaceMeta = {
    slug: tenant.slug,
    statusLabel: formatEnumLabel(tenant.status),
    planLabel: formatEnumLabel(tenant.plan),
    roleLabel,
    membershipLabel: formatEnumLabel(membership?.status ?? "ACTIVE"),
    currency: tenant.defaultCurrency,
    timezone: tenant.defaultTimezone,
  };

  const modules = {
    moduleSales: tenant.settings?.moduleSales ?? true,
    moduleFinance: tenant.settings?.moduleFinance ?? true,
    moduleMarketing: tenant.settings?.moduleMarketing ?? true,
    moduleCommunity: tenant.settings?.moduleCommunity ?? true,
    moduleRealtorPortal: tenant.settings?.moduleRealtorPortal ?? true,
    moduleShortLets: tenant.settings?.moduleShortLets ?? false,
    moduleHr: tenant.settings?.moduleHr ?? false,
    moduleTasks: tenant.settings?.moduleTasks ?? true,
    moduleClients: tenant.settings?.moduleClients ?? false,
    moduleWhatsApp: tenant.settings?.moduleWhatsApp !== false,
    moduleListings: tenant.settings?.moduleListings !== false,
    moduleInvestorPortal: tenant.settings?.moduleInvestorPortal ?? false,
  };

  const roleModuleGrantsJson = JSON.stringify(
    (tenant.settings?.roleModuleGrants as object | null | undefined) ?? {},
    null,
    2,
  );
  const orgDepartments = mergeOrgDepartments(tenant.settings?.orgDepartments as string[] | null | undefined);

  return (
    <div className="w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
      <p className="mt-1 text-sm text-muted">Your account and organization preferences.</p>

      <div className="mt-6">
        <SettingsWorkspace
          tenantSlug={tenant.slug}
          tenantName={tenant.name}
          initialTab={parseSettingsTab(sp.tab)}
          userDisplayName={user?.name || user?.email || "User"}
          userEmail={user?.email ?? null}
          canManageOrg={canManageOrg}
          modules={modules}
          roleModuleGrantsJson={roleModuleGrantsJson}
          orgDepartments={orgDepartments}
          workspaceMeta={workspaceMeta}
          branding={{
            logoUrl: tenant.settings?.logoUrl ?? null,
            primaryColor: tenant.settings?.primaryColor ?? "#1e3a5f",
            accentColor: tenant.settings?.accentColor ?? "#4f46e5",
            orgEmail: tenant.settings?.orgEmail ?? null,
            orgPhone: tenant.settings?.orgPhone ?? null,
            orgAddressLine: tenant.settings?.orgAddressLine ?? null,
            orgCity: tenant.settings?.orgCity ?? null,
            orgState: tenant.settings?.orgState ?? null,
            orgCountry: tenant.settings?.orgCountry ?? "Nigeria",
          }}
          integrations={{
            metaVerifyToken: tenant.settings?.metaVerifyToken ?? null,
            metaPageAccessToken: tenant.settings?.metaPageAccessToken ?? null,
            metaDefaultSource: tenant.settings?.metaDefaultSource ?? null,
            termiiApiKey: tenant.settings?.termiiApiKey ?? null,
            termiiSenderId: tenant.settings?.termiiSenderId ?? null,
            whatsappAccessToken: tenant.settings?.whatsappAccessToken ?? null,
            whatsappPhoneNumberId: tenant.settings?.whatsappPhoneNumberId ?? null,
            whatsappVerifyToken: tenant.settings?.whatsappVerifyToken ?? null,
            whatsappBotEnabled: tenant.settings?.whatsappBotEnabled ?? false,
            moduleWhatsApp: tenant.settings?.moduleWhatsApp !== false,
            logoUrl: tenant.settings?.logoUrl ?? null,
            financeBankAccounts: (tenant.settings?.financeBankAccounts as string[] | null | undefined) ?? [],
            financePaymentModes: (tenant.settings?.financePaymentModes as string[] | null | undefined) ?? [],
            financeCurrencies: (tenant.settings?.financeCurrencies as string[] | null | undefined) ?? [tenant.defaultCurrency],
          }}
        />
      </div>
    </div>
  );
}
