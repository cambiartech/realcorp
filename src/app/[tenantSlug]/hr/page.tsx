import { auth } from "@/auth";
import { canManageHr, canViewHrModule } from "@/lib/hr-access";
import { normalizeSettingsNavSlice } from "@/lib/tenant-nav-access";
import prisma from "@/lib/db";
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
  const session = await auth();
  if (!session?.user?.id) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      settings: { select: { moduleHr: true, roleModuleGrants: true } },
    },
  });
  if (!tenant) notFound();

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true, status: true },
  });

  const settingsNav = normalizeSettingsNavSlice(tenant.settings);
  if (!canViewHrModule(Boolean(session.user.isPlatformAdmin), membership, settingsNav.moduleHr)) {
    redirect(`/${tenantSlug}`);
  }

  const canManage = canManageHr(Boolean(session.user.isPlatformAdmin), membership);
  const sp = await searchParams;
  const tab = sp.tab;

  if (tab === "people") redirect(`/${tenantSlug}/hr/people`);
  if (tab === "payslips") redirect(`/${tenantSlug}/hr/payslips`);
  if (tab === "appraisals") redirect(`/${tenantSlug}/hr/appraisals`);
  if (tab === "documents") redirect(`/${tenantSlug}/hr/documents`);
  if (tab === "insights") redirect(`/${tenantSlug}/hr/insights`);
  if (tab === "my") redirect(`/${tenantSlug}/hr/dashboard`);

  redirect(canManage ? `/${tenantSlug}/hr/people` : `/${tenantSlug}/hr/dashboard`);
}
