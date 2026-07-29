import { loadShortletsContext } from "@/lib/shortlets-loaders";
import { GuestFormWorkspace } from "../guest-form-workspace";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewGuestPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const { tenantSlug } = await params;
  const sp = searchParams ? await searchParams : {};
  const ctx = await loadShortletsContext(tenantSlug);
  if (!ctx.access.canManage) notFound();

  return <GuestFormWorkspace tenantSlug={ctx.tenant.slug} mode="create" returnTo={sp.returnTo} />;
}
