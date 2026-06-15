import { guardTenantModuleLayout } from "@/lib/guard-tenant-module-layout";

export default async function FinanceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  await guardTenantModuleLayout(tenantSlug, "finance");
  return children;
}
