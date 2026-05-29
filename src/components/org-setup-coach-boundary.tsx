"use client";

import { Suspense } from "react";
import { OrgSetupCoach } from "@/components/org-setup-coach";
import type { OrgSetupStep } from "@/lib/org-setup-checklist";

export function OrgSetupCoachBoundary(props: {
  tenantSlug: string;
  userId: string;
  tenantName: string;
  steps: OrgSetupStep[];
}) {
  return (
    <Suspense fallback={null}>
      <OrgSetupCoach {...props} />
    </Suspense>
  );
}
