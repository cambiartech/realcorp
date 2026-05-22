import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { canViewHrModule } from "@/lib/hr-access";
import { normalizeSettingsNavSlice } from "@/lib/tenant-nav-access";

export default async function HrLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/${tenantSlug}/hr/dashboard`);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      settings: { select: { moduleHr: true } },
    },
  });
  if (!tenant) {
    redirect(`/${tenantSlug}`);
  }

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true, status: true },
  });

  const settingsNav = normalizeSettingsNavSlice(tenant.settings);
  if (!canViewHrModule(Boolean(session.user.isPlatformAdmin), membership, settingsNav.moduleHr)) {
    redirect(`/${tenantSlug}`);
  }

  return children;
}
