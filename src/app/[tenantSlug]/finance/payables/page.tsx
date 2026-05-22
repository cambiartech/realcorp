import FinanceQueuePage from "../page";

export default async function FinancePayablesPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{
    logsPage?: string;
    logsQ?: string;
    logsModule?: string;
    logsAction?: string;
    logsActor?: string;
    logsFrom?: string;
    logsTo?: string;
    logsEntityType?: string;
    logsEntityId?: string;
    focus?: string;
  }>;
}) {
  const { tenantSlug } = await params;
  const qp = await searchParams;
  return FinanceQueuePage({
    params: Promise.resolve({ tenantSlug }),
    searchParams: Promise.resolve({ activeTab: "records", recordsTab: "payables", ...qp }),
  });
}
