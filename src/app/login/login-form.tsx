"use client";

import { signIn } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";
import { FormAlert, FormFieldError } from "@/components/form-message";
import { ButtonSpinner } from "@/components/button-spinner";
import { safeInternalPath } from "@/lib/safe-internal-path";
import { parseLoginForm, zodIssuesToFieldRecord, type LoginFieldName } from "@/lib/validators/login";

const PENDING_EMAIL_KEY = "realcorp_pending_login_email";

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

function LoginFormInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sanitizedUrlRef = useRef(false);

  const [email, setEmail] = useState("");
  const [postInviteMessage, setPostInviteMessage] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<LoginFieldName, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [callbackPath, setCallbackPath] = useState("/auth/landing");

  useEffect(() => {
    if (sanitizedUrlRef.current) return;
    sanitizedUrlRef.current = true;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const hadSensitiveInQuery = params.has("password") || params.has("passwd") || params.has("pwd");
    const emailParam = params.get("email");
    const callbackRaw = params.get("callbackUrl");

    let nextEmail = "";
    let fromInviteFlow = false;
    try {
      const pendingStored = sessionStorage.getItem(PENDING_EMAIL_KEY);
      if (pendingStored) {
        sessionStorage.removeItem(PENDING_EMAIL_KEY);
        nextEmail = pendingStored;
        fromInviteFlow = true;
      }
    } catch {
      // ignore
    }

    if (!nextEmail && emailParam) {
      nextEmail = emailParam;
      fromInviteFlow = true;
    }

    const safeCb = safeInternalPath(callbackRaw) ?? "/auth/landing";

    const clean = new URLSearchParams();
    if (safeCb !== "/auth/landing") {
      clean.set("callbackUrl", safeCb);
    }
    const nextQuery = clean.toString();
    const current = window.location.search.startsWith("?") ? window.location.search.slice(1) : "";
    const needsReplace = hadSensitiveInQuery || current !== nextQuery;

    queueMicrotask(() => {
      if (nextEmail) setEmail(nextEmail);
      setPostInviteMessage(fromInviteFlow);
      setCallbackPath(safeCb);
      if (needsReplace) {
        router.replace(`${pathname}${nextQuery ? `?${nextQuery}` : ""}`);
      }
    });
  }, [pathname, router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const form = e.currentTarget;
    const formData = new FormData(form);
    const parsed = parseLoginForm(formData);

    if (!parsed.success) {
      setFieldErrors(zodIssuesToFieldRecord(parsed.error.issues));
      return;
    }

    setPending(true);
    const res = await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
    setPending(false);

    if (res?.error) {
      setFormError("Invalid email or password.");
      return;
    }
    window.location.href = callbackPath;
  }

  return (
    <form method="post" noValidate onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
      {postInviteMessage ? (
        <div className="border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground/80">
          You&apos;re almost in — sign in with the password you just set.
        </div>
      ) : null}
      {formError ? <FormAlert>{formError}</FormAlert> : null}

      <div>
        <label htmlFor="login-email" className="mb-1 block text-sm text-muted">
          Email
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
          className={fieldClass(Boolean(fieldErrors.email))}
        />
        {fieldErrors.email ? (
          <FormFieldError id="login-email-error">{fieldErrors.email}</FormFieldError>
        ) : null}
      </div>

      <div>
        <label htmlFor="login-password" className="mb-1 block text-sm text-muted">
          Password
        </label>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
          className={fieldClass(Boolean(fieldErrors.password))}
        />
        {fieldErrors.password ? (
          <FormFieldError id="login-password-error">{fieldErrors.password}</FormFieldError>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="inline-flex items-center justify-center gap-2 border border-foreground bg-foreground py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? <ButtonSpinner /> : null}
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={<div className="mt-8 h-48 animate-pulse bg-field" aria-hidden />}>
      <LoginFormInner />
    </Suspense>
  );
}
