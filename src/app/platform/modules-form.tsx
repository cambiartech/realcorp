"use client";

import { useState, useTransition } from "react";
import { updateTenantModulesFromPlatform } from "./actions";

type ModuleFlags = {
  moduleSales: boolean;
  moduleFinance: boolean;
  moduleMarketing: boolean;
  moduleCommunity: boolean;
  moduleRealtorPortal: boolean;
  moduleShortLets: boolean;
};

export function PlatformModulesForm({
  tenantId,
  initial,
  summary,
}: {
  tenantId: string;
  initial: ModuleFlags;
  summary: string;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(null);

  return (
    <details className="group">
      <summary className="cursor-pointer select-none rounded border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/[0.06]">
        {summary}
      </summary>
      <form
        className="mt-2 w-56 space-y-2 rounded border border-foreground/10 bg-background p-2 text-xs shadow"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setFeedback(null);
          startTransition(async () => {
            const res = await updateTenantModulesFromPlatform(tenantId, fd);
            if (res.ok) setFeedback({ kind: "ok", message: "Modules saved." });
            else setFeedback({ kind: "error", message: res.error || "Could not save modules." });
          });
        }}
      >
        <ModuleCheckbox name="moduleSales" label="Sales" defaultChecked={initial.moduleSales} />
        <ModuleCheckbox name="moduleFinance" label="Finance" defaultChecked={initial.moduleFinance} />
        <ModuleCheckbox name="moduleMarketing" label="Marketing" defaultChecked={initial.moduleMarketing} />
        <ModuleCheckbox name="moduleCommunity" label="Community" defaultChecked={initial.moduleCommunity} />
        <ModuleCheckbox name="moduleRealtorPortal" label="Realtor portal" defaultChecked={initial.moduleRealtorPortal} />
        <ModuleCheckbox name="moduleShortLets" label="Short Lets" defaultChecked={initial.moduleShortLets} />

        <button
          type="submit"
          disabled={pending}
          className="mt-1 w-full rounded border border-foreground bg-foreground px-2 py-1 text-xs font-medium text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving..." : "Save modules"}
        </button>

        {feedback ? (
          <p className={feedback.kind === "ok" ? "text-[11px] text-emerald-600" : "text-[11px] text-rose-600"}>
            {feedback.message}
          </p>
        ) : null}
      </form>
    </details>
  );
}

function ModuleCheckbox({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      <span>{label}</span>
    </label>
  );
}
