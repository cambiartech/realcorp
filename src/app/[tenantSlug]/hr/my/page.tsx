import { redirect } from "next/navigation";

/** Legacy URL — employee dashboard lives at /hr/dashboard */
export default async function HrMyRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { tenantSlug } = await params;
  const sp = await searchParams;
  const q = new URLSearchParams();
  if (sp.employeeUserId?.trim()) q.set("employeeUserId", sp.employeeUserId.trim());
  const suffix = q.size > 0 ? `?${q.toString()}` : "";
  redirect(`/${tenantSlug}/hr/dashboard${suffix}`);
}
