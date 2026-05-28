"use client";

import { useActionState, useEffect, useState } from "react";
import { FormAlert, FormFieldError } from "@/components/form-message";
import { UiSelect } from "@/components/ui-select";
import {
  parseOrganizationOnboardingForm,
  zodOnboardingIssuesToFieldRecord,
  type OnboardingFieldName,
} from "@/lib/validators/organization";
import { createOrganization, type OnboardResult } from "./actions";

const initial: OnboardResult | null = null;

const inputBase =
  "w-full border px-3 py-2 text-foreground placeholder:text-muted focus:outline-none focus:ring-2";

function fieldClass(invalid: boolean) {
  return [
    inputBase,
    "bg-field",
    invalid
      ? "border-error ring-2 ring-error/20 focus:ring-error/25"
      : "border-foreground/15 focus:ring-foreground/20 dark:border-foreground/20",
  ].join(" ");
}

const labels: Record<OnboardingFieldName, string> = {
  organizationName: "Organization name",
  slug: "URL slug",
  adminEmail: "Org admin email",
  adminName: "Org admin name (optional)",
  plan: "Plan",
};

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(createOrganization, initial);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<OnboardingFieldName, string>>>({});

  useEffect(() => {
    if (state?.ok) setFieldErrors({});
  }, [state?.ok]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const parsed = parseOrganizationOnboardingForm(fd);
    if (!parsed.success) {
      setFieldErrors(zodOnboardingIssuesToFieldRecord(parsed.error.issues));
      return;
    }
    setFieldErrors({});
    formAction(fd);
  }

  if (state?.ok) {
    return (
      <div className="border border-foreground/15 bg-foreground/[0.03] p-6 text-sm">
        <p className="font-semibold text-foreground">Organization created</p>
        <p className="mt-2 text-muted">
          Tenant slug:{" "}
          <code className="border border-foreground/10 bg-field px-1.5 py-0.5 font-mono text-xs">
            {state.tenantSlug}
          </code>
        </p>
        <p className="mt-4 text-muted">
          Send this invite link to the org admin (wire email in production):
        </p>
        <p className="mt-2 break-all border border-foreground/10 bg-field p-3 font-mono text-xs text-foreground">
          {state.inviteUrl}
        </p>
        <a
          href="/platform"
          className="mt-6 inline-block border border-foreground bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Back to platform
        </a>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
      {state && !state.ok ? <FormAlert>{state.error}</FormAlert> : null}

      <Field
        name="organizationName"
        label={labels.organizationName}
        placeholder="e.g. BO Properties"
        required
        error={fieldErrors.organizationName}
      />
      <div>
        <label htmlFor="onboard-slug" className="mb-1 block text-sm text-muted">
          {labels.slug}
        </label>
        <input
          id="onboard-slug"
          name="slug"
          required
          placeholder="bo-properties"
          aria-invalid={Boolean(fieldErrors.slug)}
          aria-describedby={
            fieldErrors.slug ? "onboard-slug-error" : "onboard-slug-hint"
          }
          className={`${fieldClass(Boolean(fieldErrors.slug))} font-mono text-sm`}
        />
        <p id="onboard-slug-hint" className="mt-1 text-xs text-muted">
          Lowercase letters, numbers, and single hyphens only.
        </p>
        {fieldErrors.slug ? (
          <FormFieldError id="onboard-slug-error">{fieldErrors.slug}</FormFieldError>
        ) : null}
      </div>
      <Field
        name="adminEmail"
        label={labels.adminEmail}
        type="text"
        inputMode="email"
        autoComplete="email"
        placeholder="ceo@company.com"
        required
        error={fieldErrors.adminEmail}
      />
      <Field name="adminName" label={labels.adminName} placeholder="Full name" error={fieldErrors.adminName} />
      <div>
        <label htmlFor="onboard-plan" className="mb-1 block text-sm text-muted">
          {labels.plan}
        </label>
        <UiSelect
          id="onboard-plan"
          name="plan"
          defaultValue="GROWTH"
          aria-invalid={Boolean(fieldErrors.plan)}
          invalid={Boolean(fieldErrors.plan)}
        >
          <option value="STARTER">Starter</option>
          <option value="GROWTH">Growth</option>
          <option value="ENTERPRISE">Enterprise</option>
          <option value="ANCHOR">Anchor</option>
        </UiSelect>
        {fieldErrors.plan ? <FormFieldError>{fieldErrors.plan}</FormFieldError> : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="mt-2 inline-flex items-center justify-center gap-2 border border-foreground bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? <InlineSpinner /> : null}
        {pending ? "Creating…" : "Create organization & invite"}
      </button>
    </form>
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

function Field({
  name,
  label,
  type = "text",
  placeholder,
  required,
  error,
  inputMode,
  autoComplete,
}: {
  name: OnboardingFieldName;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
}) {
  const id = `onboard-${name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm text-muted">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={fieldClass(Boolean(error))}
      />
      {error ? <FormFieldError id={`${id}-error`}>{error}</FormFieldError> : null}
    </div>
  );
}
