import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { loadInvestorOrganizations } from "@/lib/portal";
import { InvestorHubWorkspace } from "./investor-hub-workspace";

export const dynamic = "force-dynamic";

export default async function InvestorHubPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/investor");

  const organizations = await loadInvestorOrganizations(session.user.id);

  return <InvestorHubWorkspace userName={session.user.name ?? null} organizations={organizations} />;
}
