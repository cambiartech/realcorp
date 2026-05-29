"use client";

import { Suspense } from "react";
import { CaptureFormDetailWorkspace } from "@/components/capture-forms/capture-form-detail-workspace";
import type { ComponentProps } from "react";

function CaptureFormDetailFallback() {
  return <div className="px-6 py-10 text-sm text-muted">Loading form…</div>;
}

export function CaptureFormDetailClient(props: ComponentProps<typeof CaptureFormDetailWorkspace>) {
  return (
    <Suspense fallback={<CaptureFormDetailFallback />}>
      <CaptureFormDetailWorkspace {...props} />
    </Suspense>
  );
}
