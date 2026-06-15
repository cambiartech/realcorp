import { guardTenantModuleLayout } from "@/lib/guard-tenant-module-layout";

export default async function MarketingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  await guardTenantModuleLayout(tenantSlug, "marketing");
  return children;
}
