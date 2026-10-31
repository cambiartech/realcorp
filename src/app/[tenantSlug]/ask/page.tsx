import { notFound } from "next/navigation";
import { OrgAssistantChat } from "@/components/org-assistant/org-assistant-chat";
import { assistantModules, canUseOrgAssistant } from "@/lib/org-assistant/access";
import { loadTenantRequest } from "@/lib/tenant-request";

export const dynamic = "force-dynamic";

export default async function AskAiPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { session, tenant, membership } = await loadTenantRequest(tenantSlug);
  if (!session?.user?.id || !tenant) notFound();
  if (!canUseOrgAssistant(Boolean(session.user.isPlatformAdmin), membership, tenant.settings)) notFound();

  const modules = assistantModules(tenant.settings);
  const suggestions = [
    "Give me a consultancy-style summary of how the business is doing this month, with trends",
    "Compare this month vs last month across the main KPIs and chart the changes",
    modules.finance ? "Show payments vs expenses by week for the last 8 weeks as a chart" : null,
    modules.finance ? "Which invoices are overdue and how much is owed?" : null,
    modules.sales ? "Chart lead volume by week this quarter and name the top sources" : null,
    modules.sales ? "Which salesperson closed the most deals this quarter?" : null,
    modules.shortlets ? "Short-let revenue trend by month, by property" : null,
    modules.hr ? "What did payroll cost us over the last 3 months?" : null,
    modules.tasks ? "Who are the top task performers this week, with a ranking chart?" : null,
  ].filter((s): s is string => Boolean(s));

  return (
    <OrgAssistantChat
      tenantSlug={tenant.slug}
      orgName={tenant.name}
      userName={session.user.name?.split(" ")[0] ?? null}
      suggestions={suggestions.slice(0, 6)}
    />
  );
}
