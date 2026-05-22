import FinanceQueuePage from "../page";

export default async function FinanceOverviewPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return FinanceQueuePage({
    params: Promise.resolve({ tenantSlug }),
    searchParams: Promise.resolve({ activeTab: "queue" }),
  });
}
