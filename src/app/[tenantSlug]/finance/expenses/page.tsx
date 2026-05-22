import FinanceQueuePage from "../page";

export default async function FinanceSubpage({
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
  }>;
}) {
  const { tenantSlug } = await params;
  const qp = await searchParams;
  return FinanceQueuePage({
    params: Promise.resolve({ tenantSlug }),
    searchParams: Promise.resolve({ activeTab: "records", recordsTab: "expenses", ...qp }),
  });
}
