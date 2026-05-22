import { HrFormBundleClient } from "@/components/hr/hr-form-bundle-client";
import { loadHrFormBundleByToken } from "@/lib/hr-form-bundle-loader";
import type { HrFormType } from "@/generated/prisma";
import { notFound } from "next/navigation";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function HrOnboardingBundlePage({
  params,
  searchParams,
}: {
  params: Promise<{ bundleToken: string }>;
  searchParams: Promise<{ form?: string; tenant?: string }>;
}) {
  const { bundleToken } = await params;
  const { form, tenant: tenantFromQuery } = await searchParams;
  const bundle = await loadHrFormBundleByToken(bundleToken);
  if (!bundle) notFound();

  const initialFormType = form && bundle.steps.some((s) => s.formType === form) ? (form as HrFormType) : null;

  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 p-8 text-center text-sm text-slate-600">Loading…</div>}>
      <HrFormBundleClient
        bundle={bundle}
        tenantSlug={bundle.tenantSlug || tenantFromQuery}
        initialFormType={initialFormType}
      />
    </Suspense>
  );
}
