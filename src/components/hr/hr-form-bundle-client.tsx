"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HrPublicFormClient } from "@/components/hr/hr-public-form-client";
import { BrandedDocumentShell } from "@/components/hr/branded-document-shell";
import type { HrFormRequestStatus, HrFormType } from "@/generated/prisma";
import { hrOnboardingBundlePath } from "@/lib/hr-form-types";
import type { TenantBranding } from "@/lib/tenant-branding";
import { brandingCssVars } from "@/lib/tenant-branding";

type BundleStep = {
  id: string;
  formType: HrFormType;
  formTypeLabel: string;
  token: string;
  status: HrFormRequestStatus;
  deliveryMode: import("@/generated/prisma").HrFormDeliveryMode;
  initialValues: Record<string, string>;
  printPath: string;
};

const STEP_SHORT: Record<HrFormType, string> = {
  BIODATA: "Biodata",
  BANK_FORM: "Bank",
  GUARANTOR: "Guarantor",
  HEALTH: "Health",
};

function isComplete(status: HrFormRequestStatus) {
  return status === "SUBMITTED" || status === "APPROVED";
}

function firstActionableIndex(steps: BundleStep[]) {
  const pending = steps.findIndex((s) => s.status === "PENDING");
  if (pending >= 0) return pending;
  return Math.max(0, steps.length - 1);
}

export function HrFormBundleClient({
  bundle,
  tenantSlug: tenantSlugProp,
  initialFormType,
}: {
  bundle: {
    bundleToken: string;
    tenantSlug?: string;
    brand: TenantBranding;
    employeeName: string;
    hrNote: string | null;
    expiresAt: Date;
    steps: BundleStep[];
    allExpired: boolean;
    allDone: boolean;
  };
  /** Org URL segment, e.g. bopropertiesng — required for My dashboard link. */
  tenantSlug?: string;
  initialFormType?: HrFormType | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantSlug = (tenantSlugProp || bundle.tenantSlug || searchParams.get("tenant") || "").trim();
  const hubPath = (form?: string) =>
    hrOnboardingBundlePath(bundle.bundleToken, {
      tenant: tenantSlug || undefined,
      form,
    });
  const dashboardHref = tenantSlug ? `/${tenantSlug}/hr/dashboard` : null;
  const [steps, setSteps] = useState(bundle.steps);
  const [activeIndex, setActiveIndex] = useState(() => {
    const fromQuery = initialFormType ?? (searchParams.get("form") as HrFormType | null);
    if (fromQuery) {
      const idx = bundle.steps.findIndex((s) => s.formType === fromQuery);
      if (idx >= 0) return idx;
    }
    return firstActionableIndex(bundle.steps);
  });

  useEffect(() => {
    const form = searchParams.get("form") as HrFormType | null;
    if (!form) return;
    const idx = steps.findIndex((s) => s.formType === form);
    if (idx >= 0) setActiveIndex(idx);
  }, [searchParams, steps]);

  const active = steps[activeIndex];
  const completedCount = useMemo(() => steps.filter((s) => isComplete(s.status)).length, [steps]);

  function handleStepSubmitted() {
    setSteps((prev) => {
      const updated = prev.map((s, i) => (i === activeIndex ? { ...s, status: "SUBMITTED" as const } : s));
      const nextIdx = updated.findIndex((s) => s.status === "PENDING");
      if (nextIdx >= 0) {
        setActiveIndex(nextIdx);
        router.replace(hubPath(updated[nextIdx]!.formType), { scroll: false });
      }
      return updated;
    });
    router.refresh();
  }

  function selectStep(index: number) {
    const step = steps[index];
    if (step.status === "EXPIRED" || step.status === "CANCELLED") return;
    setActiveIndex(index);
    router.replace(hubPath(step.formType), { scroll: false });
  }

  if (bundle.allExpired) {
    return (
      <Shell brand={bundle.brand} title="Onboarding link expired" dashboardHref={dashboardHref ?? undefined}>
        <p className="text-sm text-slate-600">This link is no longer active. Contact HR for a new link.</p>
      </Shell>
    );
  }

  if (bundle.allDone || (completedCount === steps.length && steps.every((s) => isComplete(s.status)))) {
    return (
      <Shell brand={bundle.brand} title="All done" dashboardHref={dashboardHref ?? undefined}>
        <p className="text-sm text-slate-700">
          Thank you{bundle.employeeName ? `, ${bundle.employeeName}` : ""}. All {steps.length} sections have
          been submitted. HR will review your information.
        </p>
        {dashboardHref ? (
          <Link
            href={dashboardHref}
            className="mt-4 inline-flex w-full items-center justify-center rounded-lg py-3 text-sm font-semibold text-white"
            style={{ background: "var(--hr-brand-primary)" }}
          >
            Back to My dashboard
          </Link>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            You can close this page. Contact HR if you need anything else.
          </p>
        )}
      </Shell>
    );
  }

  if (!active) return null;

  return (
    <div className="min-h-screen bg-slate-50" style={brandingCssVars(bundle.brand)}>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {dashboardHref ? (
              <Link
                href={dashboardHref}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                ← My dashboard
              </Link>
            ) : null}
            <p className="text-xs font-medium text-slate-500">
              {completedCount} of {steps.length} complete
            </p>
          </div>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Onboarding</p>
          <nav
            className="mt-2 flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Onboarding sections"
          >
            {steps.map((step, i) => {
              const done = isComplete(step.status);
              const current = i === activeIndex;
              const disabled = step.status === "EXPIRED" || step.status === "CANCELLED";
              return (
                <button
                  key={step.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectStep(i)}
                  className={[
                    "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    current
                      ? "bg-slate-900 text-white shadow-sm"
                      : done
                        ? "bg-[var(--success-wash)] text-[var(--success)] ring-1 ring-[var(--success-line)]"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200",
                    disabled ? "cursor-not-allowed opacity-40" : "",
                  ].join(" ")}
                >
                  {done ? "✓ " : ""}
                  {STEP_SHORT[step.formType]}
                </button>
              );
            })}
          </nav>
          {bundle.hrNote ? (
            <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-slate-600">{bundle.hrNote}</p>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <HrPublicFormClient
          key={active.token}
          token={active.token}
          formType={active.formType}
          deliveryMode={active.deliveryMode}
          status={active.status}
          brand={bundle.brand}
          employeeName={bundle.employeeName}
          hrNote={bundle.hrNote}
          initialValues={active.initialValues}
          printPath={active.printPath}
          embedded
          suppressBackNav
          dashboardHref={dashboardHref ?? undefined}
          onSubmitted={handleStepSubmitted}
        />
      </main>
    </div>
  );
}

function Shell({
  brand,
  title,
  dashboardHref,
  children,
}: {
  brand: TenantBranding;
  title: string;
  dashboardHref?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4" style={brandingCssVars(brand)}>
      <div className="mx-auto max-w-md">
        {dashboardHref ? (
          <Link
            href={dashboardHref}
            className="mb-4 inline-flex text-sm font-semibold text-slate-600 underline hover:text-slate-900"
          >
            ← My dashboard
          </Link>
        ) : null}
        <BrandedDocumentShell brand={brand} title={title}>
          {children}
        </BrandedDocumentShell>
      </div>
    </div>
  );
}
