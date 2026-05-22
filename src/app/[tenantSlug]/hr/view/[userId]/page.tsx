import { redirect } from "next/navigation";

/** HR admin shortcut: preview an employee's My dashboard */
export default async function HrEmployeeViewPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; userId: string }>;
}) {
  const { tenantSlug, userId } = await params;
  redirect(`/${tenantSlug}/hr/dashboard?employeeUserId=${encodeURIComponent(userId)}`);
}
