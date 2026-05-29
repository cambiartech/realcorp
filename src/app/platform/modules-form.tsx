"use client";

import { useState, useTransition } from "react";
import { ButtonSpinner } from "@/components/button-spinner";
import {
  normalizeTenantModuleFlags,
  TENANT_MODULE_DEFINITIONS,
  TENANT_MODULE_GROUPS,
  type TenantModuleFlags,
} from "@/lib/tenant-module-definitions";
import { updateTenantModulesFromPlatform } from "./actions";

export function PlatformModulesForm({
  tenantId,
  initial,
  summary,
}: {
  tenantId: string;
  initial: Partial<TenantModuleFlags>;
  summary: string;
}) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const flags = normalizeTenantModuleFlags(initial);

  return (
    <details className="group">
      <summary className="cursor-pointer select-none rounded-md border border-foreground/15 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-foreground/[0.04]">
        {summary}
      </summary>
      <form
        className="mt-2 w-[min(18rem,80vw)] space-y-3 rounded-lg border border-foreground/10 bg-background p-3 text-xs shadow-lg"
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
        {TENANT_MODULE_GROUPS.map((group) => {
          const items = TENANT_MODULE_DEFINITIONS.filter((d) => d.group === group.id);
          if (items.length === 0) return null;
          return (
            <div key={group.id}>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">{group.label}</p>
              <div className="space-y-2">
                {items.map((def) => (
                  <ModuleCheckbox key={def.key} name={def.key} label={def.label} hint={def.description} defaultChecked={flags[def.key]} />
                ))}
              </div>
            </div>
          );
        })}

        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-md border border-foreground bg-foreground px-2 py-2 text-xs font-semibold text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? <ButtonSpinner /> : null}
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
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-0.5 hover:bg-foreground/[0.03]">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5" />
      <span>
        <span className="font-medium text-foreground">{label}</span>
        {hint ? <span className="mt-0.5 block text-[10px] leading-snug text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}
