import { canManageHr, canViewHrModule } from "@/lib/hr-access";
import { normalizeSettingsNavSlice } from "@/lib/tenant-nav-access";
import { loadTenantRequest } from "@/lib/tenant-request";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HrPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tenantSlug } = await params;
  const { session, tenant, membership } = await loadTenantRequest(tenantSlug);
  if (!session?.user?.id) notFound();
  if (!tenant) notFound();

  const settingsNav = normalizeSettingsNavSlice(tenant.settings);
  if (!canViewHrModule(Boolean(session.user.isPlatformAdmin), membership, settingsNav.moduleHr)) {
    redirect(`/${tenantSlug}`);
  }

  const canManage = canManageHr(Boolean(session.user.isPlatformAdmin), membership);
  const sp = await searchParams;
  const tab = sp.tab;

  if (tab === "people") redirect(`/${tenantSlug}/hr/people`);
  if (tab === "leave") redirect(`/${tenantSlug}/hr/leave`);
  if (tab === "payslips") redirect(`/${tenantSlug}/hr/payslips`);
  if (tab === "remittances") redirect(`/${tenantSlug}/hr/remittances`);
  if (tab === "appraisals") redirect(`/${tenantSlug}/hr/appraisals`);
  if (tab === "documents") redirect(`/${tenantSlug}/hr/documents`);
  if (tab === "insights") redirect(`/${tenantSlug}/hr/insights`);
  if (tab === "my") redirect(`/${tenantSlug}/hr/dashboard`);

  redirect(canManage ? `/${tenantSlug}/hr/people` : `/${tenantSlug}/hr/dashboard`);
}
