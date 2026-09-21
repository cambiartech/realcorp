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

  return (
    <div className="rounded-xl border border-foreground/[0.08] bg-background p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-foreground">
          {serviceProviderMode ? "Payroll readiness" : "Onboarding checklist"}
        </p>
        <span className="text-[12px] font-medium tabular-nums text-muted">{percent}%</span>
      </div>
      {serviceProviderMode ? (
        <p className="mb-3 text-[11px] text-muted">
          Service / contract staff do not need biodata, guarantor, NDA, or offer-letter forms. Track pay only.
        </p>
      ) : (
        <p className="mb-3 text-[11px] text-muted">
          % uses required items only. TIN / pension stay optional (blank or NIL).
        </p>
      )}
      <div className="mb-3 h-1 overflow-hidden rounded-full bg-foreground/[0.06]">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="flex gap-2.5 text-[13px]">
            {item.done ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" strokeWidth={1.75} />
            ) : item.optional ? (
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted/40" strokeWidth={1.5} />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted" strokeWidth={1.75} />
            )}
            <span className={item.done ? "text-foreground" : "text-muted"}>
              {item.label}
              {item.optional ? (
                <span className="ml-1 text-[10px] font-medium uppercase tracking-wide text-muted/70">
                  optional
                </span>
              ) : null}
              {item.hint && !item.done ? <span className="mt-0.5 block text-[11px] text-muted/80">{item.hint}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      {serviceProviderMode ? (
        <div className="mt-4 border-t border-foreground/10 pt-3">
          <Link href={`/${tenantSlug}/hr/payslips`} className="text-xs font-semibold text-foreground underline">
            Open Payslips →
          </Link>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2 border-t border-foreground/10 pt-3">
          {onPrefillFromDocs ? <PrefillWithAiButton pending={prefillPending} onClick={onPrefillFromDocs} /> : null}
          {onGenerateOffer ? (
            <button
              type="button"
              onClick={onGenerateOffer}
              className="rounded-md border border-foreground/15 px-3 py-1.5 text-left text-xs font-semibold hover:bg-foreground/[0.06]"
            >
              {offer?.done ? "View / reprint offer letter" : "Generate offer letter"}
            </button>
          ) : null}
          {onSendForm ? (
            <>
              {onSendAllForms ? (
                <button
                  type="button"
                  onClick={onSendAllForms}
                  className="rounded-md border border-foreground bg-foreground px-3 py-1.5 text-left text-xs font-semibold text-background"
                >
                  Send all forms at once (biodata, bank, guarantor)
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onSendForm("BIODATA")}
                className="text-xs font-semibold text-foreground underline"
              >
                Send biodata form
              </button>
              <button
                type="button"
                onClick={() => onSendForm("BANK_FORM")}
                className="text-xs font-semibold text-foreground underline"
              >
                Send bank form
              </button>
              <button
                type="button"
                onClick={() => onSendForm("GUARANTOR")}
                className="text-xs font-semibold text-foreground underline"
              >
                Send guarantor form
              </button>
            </>
          ) : null}
          {inOnboardingWizard && onOpenDocuments ? (
            <button
              type="button"
              onClick={onOpenDocuments}
              className="text-left text-xs font-semibold text-foreground underline"
            >
              Upload signed NDA / documents (for this employee) →
            </button>
          ) : (
            <Link
              href={`/${tenantSlug}/hr/documents`}
              className="text-xs font-semibold text-foreground underline"
            >
              Upload signed NDA / documents →
            </Link>
          )}
          {!nda?.done || !guarantor?.done ? (
            <p className="text-[10px] text-muted">
              Upload signed NDA and guarantor under Documents after the employee returns them.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
