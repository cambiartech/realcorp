"use client";

import { Eye, EyeOff } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ButtonSpinner } from "@/components/button-spinner";
import { FormAlert, FormFieldError } from "@/components/form-message";
import {
  parseResetPasswordForm,
  zodResetIssuesToFieldRecord,
  type ResetPasswordFieldName,
} from "@/lib/validators/password-reset";
import { completePasswordReset, type ResetPasswordResult } from "./actions";

const initial: ResetPasswordResult | null = null;

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

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(completePasswordReset, initial);
  const [isTransitionPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ResetPasswordFieldName, string>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const busy = pending || isTransitionPending;

  useEffect(() => {
    if (state?.ok) router.push(state.redirectTo);
  }, [router, state]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const parsed = parseResetPasswordForm(new FormData(form));
    if (!parsed.success) {
      setFieldErrors(zodResetIssuesToFieldRecord(parsed.error.issues));
      return;
    }
    setFieldErrors({});
    startTransition(() => {
      formAction(new FormData(form));
    });
  }

  return (
    <form method="post" noValidate onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
      {state && !state.ok ? <FormAlert>{state.error}</FormAlert> : null}
      <input type="hidden" name="token" value={token} />

      <PasswordField
        id="reset-password"
        name="password"
        label="New password"
        autoComplete="new-password"
        error={fieldErrors.password}
        visible={showPassword}
        onToggle={() => setShowPassword((v) => !v)}
      />
      <PasswordField
        id="reset-confirm"
        name="confirmPassword"
        label="Confirm password"
        autoComplete="new-password"
        error={fieldErrors.confirmPassword}
        visible={showConfirm}
        onToggle={() => setShowConfirm((v) => !v)}
      />

      <button
        type="submit"
        disabled={busy}
        aria-busy={busy}
        className="inline-flex items-center justify-center gap-2 border border-foreground bg-foreground py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy ? <ButtonSpinner /> : null}
        {busy ? "Saving…" : "Save new password"}
      </button>
    </form>
  );
}

function PasswordField({
  id,
  name,
  label,
  autoComplete,
  error,
  visible,
  onToggle,
}: {
  id: string;
  name: ResetPasswordFieldName;
  label: string;
  autoComplete: string;
  error?: string;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm text-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder="Minimum 8 characters"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={[fieldClass(Boolean(error)), "pr-10"].join(" ")}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center text-muted hover:text-foreground"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>
      {error ? <FormFieldError id={`${id}-error`}>{error}</FormFieldError> : null}
    </div>
  );
}
