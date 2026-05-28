import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { canViewTasksModule } from "@/lib/tasks-access";
import { normalizeSettingsNavSlice } from "@/lib/tenant-nav-access";

export default async function TasksLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/${tenantSlug}/tasks`);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, settings: { select: { moduleTasks: true } } },
  });
  if (!tenant) redirect(`/${tenantSlug}`);

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true, status: true },
  });

  const settingsNav = normalizeSettingsNavSlice(tenant.settings);
  if (!canViewTasksModule(Boolean(session.user.isPlatformAdmin), membership, settingsNav.moduleTasks)) {
    redirect(`/${tenantSlug}`);
  }

  return children;
}
