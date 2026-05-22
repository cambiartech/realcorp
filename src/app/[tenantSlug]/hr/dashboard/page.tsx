import { Suspense } from "react";
import HrQueuePage from "../hr-queue-page";

/** Employee self-service HR dashboard (payslips, record, forms). */
export default function HrDashboardPage(props: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="py-8 text-center text-sm text-muted">Loading dashboard…</p>}>
      <HrQueuePage {...props} tab="my" />
    </Suspense>
  );
}
