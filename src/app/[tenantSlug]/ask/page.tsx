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
    "Give me a summary of how the business is doing this month",
    modules.finance ? "Compare money in and expenses for last month vs this month" : null,
    modules.finance ? "Which invoices are overdue and how much is owed?" : null,
    modules.sales ? "Which salesperson closed the most deals this quarter?" : null,
    modules.sales ? "Where are our leads coming from in the last 30 days?" : null,
    modules.shortlets ? "How did our short lets perform last month, by property?" : null,
    modules.hr ? "What did payroll cost us over the last 3 months?" : null,
    modules.tasks ? "Who has the most overdue tasks?" : null,
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
