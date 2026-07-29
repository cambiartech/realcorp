"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormAlert, FormFieldError } from "@/components/form-message";
import { ButtonSpinner } from "@/components/button-spinner";
import { UiSelect } from "@/components/ui-select";
import { addProjectStakeholder } from "@/app/[tenantSlug]/projects/actions";

type PortalMember = {
  userId: string;
  role: "INVESTOR" | "LISTING_OWNER";
  label: string;
};

type ActionResult = { ok: true } | { ok: false; error: string };
const initial: ActionResult | null = null;

const FIELD_CLASS =
  "w-full border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20";

const STAKE_TYPE_LABEL: Record<PortalMember["role"], string> = {
  INVESTOR: "Investor",
  LISTING_OWNER: "Listing owner",
};

export function AddStakeholderForm({
  tenantSlug,
  projectId,
  portalMembers,
  onSuccess,
}: {
  tenantSlug: string;
  projectId: string;
  portalMembers: PortalMember[];
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    addProjectStakeholder.bind(null, tenantSlug, projectId),
    initial,
  );
  const [fieldErrors, setFieldErrors] = useState<{ userId?: string; investmentAmount?: string }>({});
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      formRef.current?.reset();
      setFieldErrors({});
      onSuccess?.();
    }
  }, [state, onSuccess]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    const fd = new FormData(e.currentTarget);
    const userId = (fd.get("userId") as string)?.trim();
    const amountRaw = ((fd.get("investmentAmount") as string) ?? "").replace(/[,\s]/g, "");
    const amount = Number(amountRaw);
    const errors: typeof fieldErrors = {};
    if (!userId) errors.userId = "Choose an investor or listing owner.";
    if (!Number.isFinite(amount) || amount <= 0) errors.investmentAmount = "Enter a valid allocation amount.";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    formAction(fd);
  }

  if (portalMembers.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-foreground/15 bg-foreground/[0.02] px-4 py-4 text-sm text-muted">
        No investor accounts yet. Invite someone from{" "}
        <Link
          href={`/${tenantSlug}/team`}
          className="font-medium text-foreground underline underline-offset-2"
        >
          Team
        </Link>{" "}
        with the Investor or Listing owner role, then link them here.
      </p>
    );
  }

  return (
    <form ref={formRef} noValidate onSubmit={handleSubmit} className="space-y-3">
      {state && !state.ok ? <FormAlert>{state.error}</FormAlert> : null}
      <p className="text-sm font-medium text-foreground">Add stakeholder</p>

      <div>
        <label htmlFor="stakeholder-member" className="mb-1 block text-sm text-muted">
          Member
        </label>
        <UiSelect
          id="stakeholder-member"
          name="userId"
          defaultValue=""
          invalid={Boolean(fieldErrors.userId)}
          aria-describedby={fieldErrors.userId ? "stakeholder-member-error" : undefined}
        >
          <option value="" disabled>
            Select investor or listing owner…
          </option>
          {portalMembers.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.label} ({STAKE_TYPE_LABEL[m.role]})
            </option>
          ))}
        </UiSelect>
        {fieldErrors.userId ? (
          <FormFieldError id="stakeholder-member-error">{fieldErrors.userId}</FormFieldError>
        ) : null}
      </div>

      <div>
        <label htmlFor="stakeholder-allocation" className="mb-1 block text-sm text-muted">
          Allocation amount
        </label>
        <input
          id="stakeholder-allocation"
          name="investmentAmount"
          inputMode="decimal"
          placeholder="e.g. 50,000,000"
          className={FIELD_CLASS}
          aria-invalid={Boolean(fieldErrors.investmentAmount)}
          aria-describedby={fieldErrors.investmentAmount ? "stakeholder-allocation-error" : undefined}
        />
        {fieldErrors.investmentAmount ? (
          <FormFieldError id="stakeholder-allocation-error">{fieldErrors.investmentAmount}</FormFieldError>
        ) : (
          <p className="mt-1 text-xs text-muted">
            Earnings split proportionally across all allocations on this project.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="stakeholder-notes" className="mb-1 block text-sm text-muted">
          Notes <span className="font-normal">(optional)</span>
        </label>
        <input id="stakeholder-notes" name="notes" placeholder="Internal note" className={FIELD_CLASS} />
      </div>

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? <ButtonSpinner /> : null}
          {pending ? "Saving…" : "Save stakeholder"}
        </button>
      </div>
    </form>
  );
}
