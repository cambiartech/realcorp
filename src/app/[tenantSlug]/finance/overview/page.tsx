import FinanceQueuePage from "../page";

export default async function FinanceOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams?: Promise<{
    month?: string;
    period?: string;
    year?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const { tenantSlug } = await params;
  const qp = searchParams ? await searchParams : {};
  return FinanceQueuePage({
    params: Promise.resolve({ tenantSlug }),
    searchParams: Promise.resolve({
      activeTab: "queue",
      month: typeof qp.month === "string" ? qp.month : undefined,
      period: typeof qp.period === "string" ? qp.period : undefined,
      year: typeof qp.year === "string" ? qp.year : undefined,
      from: typeof qp.from === "string" ? qp.from : undefined,
      to: typeof qp.to === "string" ? qp.to : undefined,
    }),
  });
}
