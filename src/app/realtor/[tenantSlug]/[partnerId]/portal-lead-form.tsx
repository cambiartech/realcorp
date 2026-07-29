"use client";

import { LeadQuality } from "@/generated/prisma";
import { FormAlert } from "@/components/form-message";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { ButtonSpinner } from "@/components/button-spinner";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { submitPortalLead, type PortalSubmitResult } from "./actions";

const initial: PortalSubmitResult | null = null;

export function PortalLeadForm({
  tenantSlug,
  partnerId,
  accessToken,
  projectOptions,
}: {
  tenantSlug: string;
  partnerId: string;
  accessToken: string;
  projectOptions: Array<{ id: string; name: string }>;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [state, formAction, pending] = useActionState(
    submitPortalLead.bind(null, tenantSlug, partnerId, accessToken),
    initial,
  );

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      showSnackbar("Lead submitted. Thank you.", "success");
      formRef.current?.reset();
      router.refresh();
    } else {
      showSnackbar(state.error, "error");
    }
  }, [router, showSnackbar, state]);

  return (
    <form ref={formRef} action={formAction} className="mt-4 grid gap-3 sm:grid-cols-2">
      {state && !state.ok ? (
        <div className="sm:col-span-2">
          <FormAlert>{state.error}</FormAlert>
        </div>
      ) : null}

      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">
          Lead name *
        </label>
        <input
          name="name"
          required
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:border-stone-600 dark:bg-stone-950 dark:text-stone-100"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">Email</label>
        <input
          name="email"
          type="text"
          inputMode="email"
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:border-stone-600 dark:bg-stone-950 dark:text-stone-100"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">Phone</label>
        <input
          name="phone"
          type="text"
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:border-stone-600 dark:bg-stone-950 dark:text-stone-100"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">
          Project interest
        </label>
        <UiSelect name="projectInterest" defaultValue="">
          <option value="">Not specified</option>
          {projectOptions.map((p) => (
            <option key={p.id} value={p.name}>
              {p.name}
            </option>
          ))}
        </UiSelect>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">
          Budget range
        </label>
        <input
          name="budgetRange"
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:border-stone-600 dark:bg-stone-950 dark:text-stone-100"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">Quality</label>
        <UiSelect name="quality" defaultValue={LeadQuality.WARM}>
          <option value={LeadQuality.HOT}>Hot</option>
          <option value={LeadQuality.WARM}>Warm</option>
          <option value={LeadQuality.COLD}>Cold</option>
        </UiSelect>
      </div>
      <div className="sm:col-span-2 border-t border-stone-200 pt-3 dark:border-stone-700">
        <p className="text-xs font-semibold text-stone-600 dark:text-stone-400">
          Campaign attribution (optional)
        </p>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">
          utm_source
        </label>
        <input
          name="utmSource"
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 font-mono text-sm text-stone-900 dark:border-stone-600 dark:bg-stone-950 dark:text-stone-100"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">
          utm_medium
        </label>
        <input
          name="utmMedium"
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 font-mono text-sm text-stone-900 dark:border-stone-600 dark:bg-stone-950 dark:text-stone-100"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-stone-600 dark:text-stone-400">
          utm_campaign (matches active campaign code)
        </label>
        <input
          name="utmCampaign"
          placeholder="e.g. spring-launch-2026"
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 font-mono text-sm text-stone-900 dark:border-stone-600 dark:bg-stone-950 dark:text-stone-100"
        />
      </div>
      <div className="sm:col-span-2 flex justify-end pt-2">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
        >
          {pending ? <ButtonSpinner /> : null}
          {pending ? "Submitting..." : "Submit lead"}
        </button>
      </div>
    </form>
  );
}
