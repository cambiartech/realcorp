"use client";

import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import type { ProfileChecklistItem } from "@/lib/hr-profile-checklist";
import { PrefillWithAiButton } from "@/components/hr/prefill-with-ai-button";

export function ProfileComplianceChecklist({
  items,
  percent,
  tenantSlug,
  inOnboardingWizard,
  serviceProviderMode = false,
  onOpenDocuments,
  onGenerateOffer,
  onSendForm,
  onSendAllForms,
  onPrefillFromDocs,
  prefillPending,
}: {
  items: ProfileChecklistItem[];
  percent: number;
  tenantSlug: string;
  inOnboardingWizard?: boolean;
  /** Contract / adhoc / outsourced staff — no employee form pack. */
  serviceProviderMode?: boolean;
  onOpenDocuments?: () => void;
  onGenerateOffer?: () => void;
  onSendForm?: (formType: "BIODATA" | "BANK_FORM" | "GUARANTOR" | "HEALTH") => void;
  onSendAllForms?: () => void;
  onPrefillFromDocs?: () => void;
  prefillPending?: boolean;
}) {
  const nda = items.find((i) => i.id === "nda");
  const offer = items.find((i) => i.id === "offer");
  const guarantor = items.find((i) => i.id === "guarantor");

  const remaining = items.filter((i) => !i.done);
  const done = items.filter((i) => i.done);
  const requiredLeft = remaining.filter((i) => !i.optional).length;

  return (
    <aside className="overflow-hidden rounded-xl border border-foreground/[0.08] bg-background shadow-sm">
      <div className="border-b border-foreground/[0.06] bg-foreground/[0.02] px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-foreground">
              {serviceProviderMode ? "Payroll readiness" : "Onboarding"}
            </p>
            <p className="mt-0.5 text-[11px] text-muted">
              {serviceProviderMode
                ? "Track pay setup only — no employee form pack."
                : requiredLeft > 0
                  ? `${requiredLeft} required step${requiredLeft === 1 ? "" : "s"} left`
                  : percent >= 100
                    ? "All required steps done"
                    : "Optional items remaining"}
            </p>
          </div>
          <div
            className="relative flex h-12 w-12 shrink-0 items-center justify-center"
            aria-label={`${percent}% complete`}
          >
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36" aria-hidden>
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="text-foreground/[0.08]"
              />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${(percent / 100) * 97.4} 97.4`}
                className="text-[var(--accent)] transition-[stroke-dasharray]"
              />
            </svg>
            <span className="text-[11px] font-semibold tabular-nums text-foreground">{percent}%</span>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        {serviceProviderMode ? null : (
          <p className="mb-3 text-[10px] text-muted">
            Progress counts required items only. TIN / pension stay optional.
          </p>
        )}

        {remaining.length > 0 ? (
          <div className="mb-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
              Still needed
            </p>
            <ul className="space-y-1">
              {remaining.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-2 rounded-md px-1.5 py-1.5 text-[13px] hover:bg-foreground/[0.03]"
                >
                  {item.optional ? (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted/40" strokeWidth={1.5} />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} />
                  )}
                  <span className="min-w-0 text-foreground">
                    {item.label}
                    {item.optional ? (
                      <span className="ml-1 text-[10px] font-medium uppercase tracking-wide text-muted/70">
                        optional
                      </span>
                    ) : null}
                    {item.hint ? (
                      <span className="mt-0.5 block text-[11px] text-muted/80">{item.hint}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {done.length > 0 ? (
          <details className="group" open={remaining.length === 0}>
            <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-wide text-muted marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-1">
                Done ({done.length})
                <span className="text-muted/60 group-open:hidden">· show</span>
                <span className="hidden text-muted/60 group-open:inline">· hide</span>
              </span>
            </summary>
            <ul className="mt-1.5 space-y-0.5">
              {done.map((item) => (
                <li key={item.id} className="flex gap-2 px-1.5 py-1 text-[12px] text-muted">
                  <CheckCircle2
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--success)]"
                    strokeWidth={1.75}
                  />
                  <span className="line-through decoration-foreground/20">{item.label}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>

      {serviceProviderMode ? (
        <div className="border-t border-foreground/10 px-4 py-3">
          <Link href={`/${tenantSlug}/hr/payslips`} className="text-xs font-semibold text-foreground underline">
            Open Payslips →
          </Link>
        </div>
      ) : (
        <div className="space-y-2 border-t border-foreground/10 px-4 py-3">
          {onPrefillFromDocs ? <PrefillWithAiButton pending={prefillPending} onClick={onPrefillFromDocs} /> : null}
          {onSendAllForms ? (
            <button
              type="button"
              onClick={onSendAllForms}
              className="w-full rounded-md border border-foreground bg-foreground px-3 py-2 text-left text-xs font-semibold text-background"
            >
              Send all forms
            </button>
          ) : null}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {onSendForm ? (
              <>
                <button
                  type="button"
                  onClick={() => onSendForm("BIODATA")}
                  className="text-xs font-semibold text-foreground underline"
                >
                  Biodata
                </button>
                <button
                  type="button"
                  onClick={() => onSendForm("BANK_FORM")}
                  className="text-xs font-semibold text-foreground underline"
                >
                  Bank
                </button>
                <button
                  type="button"
                  onClick={() => onSendForm("GUARANTOR")}
                  className="text-xs font-semibold text-foreground underline"
                >
                  Guarantor
                </button>
              </>
            ) : null}
            {onGenerateOffer ? (
              <button
                type="button"
                onClick={onGenerateOffer}
                className="text-xs font-semibold text-foreground underline"
              >
                {offer?.done ? "Offer letter" : "Generate offer"}
              </button>
            ) : null}
          </div>
          {inOnboardingWizard && onOpenDocuments ? (
            <button
              type="button"
              onClick={onOpenDocuments}
              className="text-left text-xs font-semibold text-foreground underline"
            >
              Upload signed NDA / documents →
            </button>
          ) : (
            <Link
              href={`/${tenantSlug}/hr/documents`}
              className="block text-xs font-semibold text-foreground underline"
            >
              Upload signed NDA / documents →
            </Link>
          )}
          {!nda?.done || !guarantor?.done ? (
            <p className="text-[10px] text-muted">
              Upload signed NDA and guarantor under Documents after they return the forms.
            </p>
          ) : null}
        </div>
      )}
    </aside>
  );
}
