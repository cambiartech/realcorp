"use client";

import { useActionState, useState } from "react";
import { FormAlert, FormFieldError } from "@/components/form-message";
import { ButtonSpinner } from "@/components/button-spinner";
import { UiSelect } from "@/components/ui-select";
import {
  INVITE_ACCESS_KIND_OPTIONS,
  INVITE_DEPARTMENT_OPTIONS,
  INVITE_PORTAL_ROLE_OPTIONS,
} from "@/lib/team-membership-roles";
import {
  parseTeamInviteForm,
  zodTeamInviteIssuesToFieldRecord,
  type TeamInviteFieldName,
} from "@/lib/validators/team-invite";
import { inviteTenantMember, type TeamInviteResult } from "./actions";

const initial: TeamInviteResult | null = null;

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

export function TeamInviteForm({ tenantSlug }: { tenantSlug: string }) {
  const [state, formAction, pending] = useActionState(inviteTenantMember.bind(null, tenantSlug), initial);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<TeamInviteFieldName, string>>>({});
  const [accessKind, setAccessKind] = useState<"department" | "org_admin" | "portal">("department");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const parsed = parseTeamInviteForm(formData);
    if (!parsed.success) {
      setFieldErrors(zodTeamInviteIssuesToFieldRecord(parsed.error.issues));
      return;
    }
    setFieldErrors({});
    formAction(formData);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-4 border border-foreground/10 p-4">
      <h2 className="text-sm font-semibold text-foreground">Invite team member</h2>
      {state && !state.ok ? <FormAlert>{state.error}</FormAlert> : null}
      {state?.ok ? (
        <div className="space-y-2">
          <p className="text-sm text-muted">
            {state.emailSent
              ? "Invite created and email sent. You can also share this link:"
              : "Invite created, but email failed. Share this link manually:"}
          </p>
          {!state.emailSent ? (
            <p className="rounded-md border border-[var(--warn-line)] bg-[var(--warn-wash)] px-3 py-2 text-xs text-foreground">
              Email delivery failed: {state.emailError || "unknown error"}.
            </p>
          ) : null}
          <p className="break-all border border-foreground/10 bg-field p-3 font-mono text-xs text-foreground">
            {state.inviteUrl}
          </p>
        </div>
      ) : null}

      <div>
        <label htmlFor="team-invite-email" className="mb-1 block text-sm text-muted">
          Email
        </label>
        <input
          id="team-invite-email"
          name="email"
          type="text"
          inputMode="email"
          autoComplete="email"
          placeholder="user@company.com"
          className={fieldClass(Boolean(fieldErrors.email))}
        />
        {fieldErrors.email ? (
          <FormFieldError id="team-invite-email-error">{fieldErrors.email}</FormFieldError>
        ) : null}
      </div>

      <div>
        <label htmlFor="team-invite-access" className="mb-1 block text-sm text-muted">
          Access type
        </label>
        <UiSelect
          id="team-invite-access"
          name="accessKind"
          value={accessKind}
          onChange={(e) => setAccessKind(e.target.value as typeof accessKind)}
        >
          {INVITE_ACCESS_KIND_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </UiSelect>
      </div>

      {accessKind === "department" ? (
        <>
          <div>
            <label htmlFor="team-invite-department" className="mb-1 block text-sm text-muted">
              Department
            </label>
            <UiSelect id="team-invite-department" name="department" defaultValue="sales">
              {INVITE_DEPARTMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </UiSelect>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isDepartmentLead" value="on" />
            Department lead / coordinator
          </label>
        </>
      ) : null}

      {accessKind === "portal" ? (
        <UiSelect name="portalRole" defaultValue="investor">
          {INVITE_PORTAL_ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </UiSelect>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="inline-flex items-center justify-center gap-2 border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? <ButtonSpinner /> : null}
        {pending ? "Creating invite…" : "Create invite"}
      </button>
    </form>
  );
}
