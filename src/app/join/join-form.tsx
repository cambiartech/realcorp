"use client";

import { Eye, EyeOff } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FormAlert, FormFieldError } from "@/components/form-message";
import { acceptInvite, type AcceptInviteResult } from "./actions";
import { parseJoinForm, zodJoinIssuesToFieldRecord, type JoinFieldName } from "@/lib/validators/join";

const initial: AcceptInviteResult | null = null;

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

type JoinFormProps = {
  token: string;
  inviteEmail: string;
  tenantName: string;
};

export function JoinForm({ token, inviteEmail, tenantName }: JoinFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(acceptInvite.bind(null, token), initial);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<JoinFieldName, string>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      try {
        sessionStorage.setItem("realcorp_pending_login_email", inviteEmail);
      } catch {
        // private mode / quota
      }
      router.push(state.redirectTo ?? "/login");
    }
  }, [router, state, inviteEmail]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const parsed = parseJoinForm(formData);

    if (!parsed.success) {
      setFieldErrors(zodJoinIssuesToFieldRecord(parsed.error.issues));
      return;
    }

    setFieldErrors({});
    formAction(formData);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4 text-left">
      {state && !state.ok ? <FormAlert>{state.error}</FormAlert> : null}

      <div className="border border-foreground/10 bg-field px-3 py-2 text-xs text-muted">
        Invitation for <span className="font-medium text-foreground">{inviteEmail}</span> to{" "}
        <span className="font-medium text-foreground">{tenantName}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="firstName"
          label="First name"
          autoComplete="given-name"
          placeholder="First name"
          required
          error={fieldErrors.firstName}
        />
        <Field
          name="lastName"
          label="Last name"
          autoComplete="family-name"
          placeholder="Last name"
          required
          error={fieldErrors.lastName}
        />
      </div>

      <PasswordField
        name="password"
        label="Password"
        autoComplete="new-password"
        placeholder="Minimum 8 characters"
        required
        error={fieldErrors.password}
        visible={showPassword}
        onToggle={() => setShowPassword((v) => !v)}
      />

      <PasswordField
        name="confirmPassword"
        label="Confirm password"
        autoComplete="new-password"
        placeholder="Repeat password"
        required
        error={fieldErrors.confirmPassword}
        visible={showConfirmPassword}
        onToggle={() => setShowConfirmPassword((v) => !v)}
      />

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="mt-2 inline-flex items-center justify-center gap-2 border border-foreground bg-foreground py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? <InlineSpinner /> : null}
        {pending ? "Accepting invite…" : "Join organization"}
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
  autoComplete,
  required,
  error,
}: {
  name: JoinFieldName;
  label: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  error?: string;
}) {
  const id = `join-${name}`;

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
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={fieldClass(Boolean(error))}
      />
      {error ? <FormFieldError id={`${id}-error`}>{error}</FormFieldError> : null}
    </div>
  );
}

function PasswordField({
  name,
  label,
  placeholder,
  autoComplete,
  required,
  error,
  visible,
  onToggle,
}: {
  name: JoinFieldName;
  label: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  error?: string;
  visible: boolean;
  onToggle: () => void;
}) {
  const id = `join-${name}`;

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
          required={required}
          placeholder={placeholder}
          autoComplete={autoComplete}
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
