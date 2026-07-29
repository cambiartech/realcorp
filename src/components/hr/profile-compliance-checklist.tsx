"use client";

import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import type { ProfileChecklistItem } from "@/lib/hr-profile-checklist";

export function ProfileComplianceChecklist({
  items,
  percent,
  tenantSlug,
  inOnboardingWizard,
  onOpenDocuments,
  onGenerateOffer,
  onSendForm,
  onSendAllForms,
}: {
  items: ProfileChecklistItem[];
  percent: number;
  tenantSlug: string;
  inOnboardingWizard?: boolean;
  onOpenDocuments?: () => void;
  onGenerateOffer?: () => void;
  onSendForm?: (formType: "BIODATA" | "BANK_FORM" | "GUARANTOR" | "HEALTH") => void;
  onSendAllForms?: () => void;
}) {
  const nda = items.find((i) => i.id === "nda");
  const offer = items.find((i) => i.id === "offer");
  const guarantor = items.find((i) => i.id === "guarantor");

  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Onboarding checklist</p>
        <span className="text-xs font-medium text-muted">{percent}% complete</span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full bg-[var(--success)] transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex gap-2 text-sm">
            {item.done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--success)]" />
            ) : (
              <Circle className="h-4 w-4 shrink-0 text-muted" />
            )}
            <span className={item.done ? "text-foreground" : "text-muted"}>
              {item.label}
              {item.hint && !item.done ? <span className="block text-[10px]">{item.hint}</span> : null}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-col gap-2 border-t border-foreground/10 pt-3">
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
                Send all forms at once (biodata, bank, guarantor, health)
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
    </div>
  );
}
