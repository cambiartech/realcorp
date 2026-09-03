import FinanceQueuePage from "../page";

export default async function FinanceOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams?: Promise<{ month?: string }>;
}) {
  const { tenantSlug } = await params;
  const qp = searchParams ? await searchParams : {};
  return FinanceQueuePage({
    params: Promise.resolve({ tenantSlug }),
    searchParams: Promise.resolve({
      activeTab: "queue",
      month: typeof qp.month === "string" ? qp.month : undefined,
    }),
  });
}
