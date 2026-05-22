import { Suspense } from "react";
import HrQueuePage from "../hr-queue-page";

export default function HrPeoplePage(props: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="py-8 text-center text-sm text-muted">Loading People…</p>}>
      <HrQueuePage {...props} tab="people" />
    </Suspense>
  );
}
