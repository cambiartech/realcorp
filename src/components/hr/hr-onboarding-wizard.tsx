"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProfileComplianceChecklist } from "@/components/hr/profile-compliance-checklist";
import type { ProfileChecklistItem } from "@/lib/hr-profile-checklist";
import { formDataToEmployeeProfilePayload, type ProfileDetailRow } from "@/lib/hr-profile-form";
import {
  type OnboardingStepId,
  writeStoredOnboardingStep,
} from "@/lib/hr-onboarding-step";
import { mergeProfileDraftFromForm, profileDraftFingerprint } from "@/lib/hr-onboarding-draft";
import { OnboardingProfileHiddenFields } from "@/components/hr/onboarding-profile-hidden-fields";
import { upsertEmployeeProfile } from "@/app/[tenantSlug]/hr/actions";

const inputClass =
  "w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20";

const STEPS: { id: OnboardingStepId; label: string }[] = [
  { id: "personal", label: "Personal & job" },
  { id: "bank", label: "Bank & emergency" },
  { id: "compliance", label: "Forms & documents" },
  { id: "activate", label: "Go live" },
];

export function HrOnboardingWizard({
  tenantSlug,
  currency,
  memberName,
  memberEmail,
  record,
  checklist,
  checklistPercent,
  initialStep,
  onComplete,
  onCancel,
  onGenerateOffer,
  onSendForm,
  onSendAllForms,
}: {
  tenantSlug: string;
  currency: string;
  memberName: string;
  memberEmail: string;
  record: ProfileDetailRow;
  checklist: ProfileChecklistItem[];
  checklistPercent: number;
  initialStep: OnboardingStepId;
  onComplete: () => void;
  onCancel: () => void;
  onGenerateOffer: () => void;
  onSendForm: (formType: "BIODATA" | "BANK_FORM" | "GUARANTOR" | "HEALTH") => void;
  onSendAllForms?: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProfileDetailRow>(record);
  const [step, setStep] = useState<OnboardingStepId>(initialStep);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(record);
  }, [record]);

  useEffect(() => {
    setStep(initialStep);
  }, [initialStep, record.userId]);

  const formKey = profileDraftFingerprint(draft);

  useEffect(() => {
    writeStoredOnboardingStep(tenantSlug, record.userId, step);
  }, [step, tenantSlug, record.userId]);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  function goToStep(next: OnboardingStepId) {
    setStep(next);
    writeStoredOnboardingStep(tenantSlug, record.userId, next);
  }

  function openDocumentsForEmployee() {
    const q = new URLSearchParams({
      forUser: record.userId,
      returnOnboard: record.userId,
    });
    router.push(`/${tenantSlug}/hr/documents?${q.toString()}`);
  }

  async function saveForm(form: HTMLFormElement, status?: string) {
    setPending(true);
    setError(null);
    try {
      const fd = new FormData(form);
      if (status) fd.set("status", status);
      const payload = formDataToEmployeeProfilePayload(fd);
      const result = await upsertEmployeeProfile(tenantSlug, payload);
      setPending(false);
      if (!result.ok) {
        setError(result.error || "Could not save.");
        return false;
      }
      setDraft((prev) => mergeProfileDraftFromForm(prev, form));
      router.refresh();
      return true;
    } catch (err) {
      setPending(false);
      setError(err instanceof Error ? err.message : "Invalid form data.");
      return false;
    }
  }

  return (
    <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.03] p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Onboarding wizard</p>
          <p className="text-xs text-muted">
            {memberName} · {memberEmail}
          </p>
        </div>
        <button type="button" onClick={onCancel} className="text-xs text-muted underline">
          Exit wizard
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-1">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => goToStep(s.id)}
            className={[
              "flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition",
              step === s.id ? "bg-foreground text-background" : i < stepIndex ? "bg-emerald-500/15 text-emerald-800" : "bg-foreground/10 text-muted hover:bg-foreground/15",
            ].join(" ")}
          >
            <span>{i + 1}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {error ? <p className="mb-3 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-800">{error}</p> : null}

      {step === "personal" ? (
        <form
          key={`onboard-personal-${formKey}`}
          id="onboard-personal"
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => e.preventDefault()}
        >
          <input type="hidden" name="userId" value={draft.userId} />
          <input type="hidden" name="status" value="DRAFT" />
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-xs font-medium">Full name *</span>
            <input name="fullName" required defaultValue={draft.fullName || memberName} className={inputClass} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium">Job title</span>
            <input name="position" defaultValue={draft.position} placeholder="e.g. Sales Manager" className={inputClass} />
            <span className="mt-1 block text-[11px] text-muted">Payroll title — separate from their Team app role.</span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium">Department</span>
            <input name="department" defaultValue={draft.department} className={inputClass} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium">Date of joining</span>
            <input name="dateOfJoining" type="date" defaultValue={draft.dateOfJoining} className={inputClass} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium">Employment type</span>
            <input name="employmentType" defaultValue={draft.employmentType || "Full-Time"} className={inputClass} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium">Mobile phone</span>
            <input name="phoneMobile" type="tel" defaultValue={draft.phoneMobile} className={inputClass} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium">Work email</span>
            <input name="workEmail" type="email" defaultValue={draft.workEmail || memberEmail} className={inputClass} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium">Monthly gross ({currency})</span>
            <input name="grossMonthly" type="number" min={0} step={0.01} defaultValue={draft.grossMonthly} className={inputClass} />
          </label>
        </form>
      ) : null}

      {step === "bank" ? (
        <form
          key={`onboard-bank-${formKey}`}
          id="onboard-bank"
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => e.preventDefault()}
        >
          <OnboardingProfileHiddenFields draft={{ ...draft, status: "DRAFT" }} statusOverride="DRAFT" />
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium">Account holder</span>
            <input name="bankAccountHolderName" defaultValue={draft.bankAccountHolderName || draft.fullName} className={inputClass} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium">Bank name</span>
            <input name="bankName" defaultValue={draft.bankName} className={inputClass} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium">Account number</span>
            <input name="bankAccountNumber" defaultValue={draft.bankAccountNumber} className={inputClass} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium">Emergency contact</span>
            <input name="emergencyName" defaultValue={draft.emergencyName} className={inputClass} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium">Emergency phone</span>
            <input name="emergencyPhone" type="tel" defaultValue={draft.emergencyPhone} className={inputClass} />
          </label>
        </form>
      ) : null}

      {step === "compliance" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ProfileComplianceChecklist
            items={checklist}
            percent={checklistPercent}
            tenantSlug={tenantSlug}
            inOnboardingWizard
            onOpenDocuments={openDocumentsForEmployee}
            onGenerateOffer={onGenerateOffer}
            onSendForm={onSendForm}
            onSendAllForms={onSendAllForms}
          />
          <div className="text-sm text-muted">
            <p className="font-medium text-foreground">What to do now</p>
            <ol className="mt-2 list-decimal space-y-2 pl-4 text-xs">
              <li>Generate and print the offer letter for signature.</li>
              <li>Send biodata, bank, and guarantor forms (links on the left).</li>
              <li>When forms are submitted, approve them under Form requests.</li>
              <li>Upload signed NDA and offer letter under Documents.</li>
            </ol>
          </div>
        </div>
      ) : null}

      {step === "activate" ? (
        <div className="space-y-3 text-sm">
          <p className="text-foreground">
            Mark <strong>{draft.fullName || memberName}</strong> as <strong>Active</strong> when onboarding is complete. They can then receive payslips and appraisals.
          </p>
          <p className="text-xs text-muted">Checklist: {checklistPercent}% complete. You can activate even if some items are pending and finish later.</p>
          <form id="onboard-activate" onSubmit={(e) => e.preventDefault()}>
            <OnboardingProfileHiddenFields draft={draft} statusOverride="ACTIVE" />
            <input type="hidden" name="bankAccountHolderName" value={draft.bankAccountHolderName} />
            <input type="hidden" name="bankName" value={draft.bankName} />
            <input type="hidden" name="bankAccountNumber" value={draft.bankAccountNumber} />
            <input type="hidden" name="emergencyName" value={draft.emergencyName} />
            <input type="hidden" name="emergencyPhone" value={draft.emergencyPhone} />
          </form>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-foreground/10 pt-4">
        <button
          type="button"
          disabled={stepIndex === 0 || pending}
          onClick={() => goToStep(STEPS[stepIndex - 1].id)}
          className="inline-flex items-center gap-1 rounded-md border border-foreground/15 px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </button>
        {step !== "activate" ? (
          <button
            type="button"
            disabled={pending}
            aria-busy={pending}
            onClick={async () => {
              const formId = step === "personal" ? "onboard-personal" : step === "bank" ? "onboard-bank" : null;
              if (formId) {
                const form = document.getElementById(formId) as HTMLFormElement | null;
                if (form && !(await saveForm(form))) return;
              }
              goToStep(STEPS[stepIndex + 1].id);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-foreground bg-foreground px-4 py-1.5 text-xs font-semibold text-background"
          >
            {pending ? <InlineSpinner /> : null}
            {pending ? "Saving…" : "Save & continue"}
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            aria-busy={pending}
            onClick={async () => {
              const form = document.getElementById("onboard-activate") as HTMLFormElement | null;
              if (form && !(await saveForm(form, "ACTIVE"))) return;
              onComplete();
            }}
            className="inline-flex items-center gap-1 rounded-md border border-emerald-600 bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white"
          >
            {pending ? <InlineSpinner /> : null}
            {pending ? "Activating…" : "Activate employee"}
          </button>
        )}
      </div>
    </div>
  );
}

function InlineSpinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.35" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
