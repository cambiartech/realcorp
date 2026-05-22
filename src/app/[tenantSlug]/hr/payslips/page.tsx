import HrQueuePage from "../hr-queue-page";

export default function HrPayslipsPage(props: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <HrQueuePage {...props} tab="payslips" />;
}
