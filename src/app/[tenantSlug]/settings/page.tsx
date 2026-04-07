import { auth } from "@/auth";
import { MembershipRole } from "@/generated/prisma";
import prisma from "@/lib/db";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import { formatEnumLabel } from "@/lib/ui-format";
import { notFound } from "next/navigation";
import { SettingsWorkspace } from "./settings-workspace";

export const dynamic = "force-dynamic";

const settingsSelect = {
  moduleSales: true,
  moduleFinance: true,
  moduleMarketing: true,
  moduleCommunity: true,
  moduleRealtorPortal: true,
  roleModuleGrants: true,
} as const;

export default async function TenantSettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
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
  };

  const roleModuleGrantsJson = JSON.stringify(
    (tenant.settings?.roleModuleGrants as object | null | undefined) ?? {},
    null,
    2,
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
      <p className="mt-1 text-sm text-muted">Your account and organization preferences.</p>

      <div className="mt-6">
        <SettingsWorkspace
          tenantSlug={tenant.slug}
          tenantName={tenant.name}
          userDisplayName={user?.name || user?.email || "User"}
          userEmail={user?.email ?? null}
          canManageOrg={canManageOrg}
          modules={modules}
          roleModuleGrantsJson={roleModuleGrantsJson}
          workspaceMeta={workspaceMeta}
        />
      </div>
    </div>
  );
}
