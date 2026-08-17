"use client";

import { useActionState, useState, useTransition } from "react";
import { ButtonSpinner } from "@/components/button-spinner";
import { FormAlert, FormFieldError } from "@/components/form-message";
import {
  parseForgotPasswordForm,
  zodForgotIssuesToFieldRecord,
  type ForgotPasswordFieldName,
} from "@/lib/validators/password-reset";
import { requestPasswordReset, type ForgotPasswordResult } from "./actions";

const initial: ForgotPasswordResult | null = null;

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

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initial);
  const [isTransitionPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ForgotPasswordFieldName, string>>>({});
  const busy = pending || isTransitionPending;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const parsed = parseForgotPasswordForm(new FormData(form));
    if (!parsed.success) {
      setFieldErrors(zodForgotIssuesToFieldRecord(parsed.error.issues));
      return;
    }
    setFieldErrors({});
    startTransition(() => {
      formAction(new FormData(form));
    });
  }

  if (state?.ok) {
    return (
      <div className="mt-8 border border-foreground/15 bg-field px-3 py-3 text-sm text-foreground/80">
        {state.message}
      </div>
    );
  }

  return (
    <form method="post" noValidate onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
      {state && !state.ok ? <FormAlert>{state.error}</FormAlert> : null}

      <div>
        <label htmlFor="forgot-email" className="mb-1 block text-sm text-muted">
          Email
        </label>
        <input
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "forgot-email-error" : undefined}
          className={fieldClass(Boolean(fieldErrors.email))}
        />
        {fieldErrors.email ? (
          <FormFieldError id="forgot-email-error">{fieldErrors.email}</FormFieldError>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={busy}
        aria-busy={busy}
        className="inline-flex items-center justify-center gap-2 border border-foreground bg-foreground py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? <ButtonSpinner /> : null}
        {busy ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
