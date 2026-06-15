"use client";

import { useState, useTransition } from "react";
import { ModalOverlay } from "@/components/modal-overlay";
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
  tenantName,
  tenantSlug,
  initial,
  summary,
}: {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  initial: Partial<TenantModuleFlags>;
  summary: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; message: string } | null>(null);
  const flags = normalizeTenantModuleFlags(initial);

  function closeSheet() {
    if (pending) return;
    setOpen(false);
    setFeedback(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-foreground/15 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-foreground/[0.04]"
      >
        <span className="text-[10px] text-muted">▸</span>
        {summary}
      </button>

      <ModalOverlay
        open={open}
        onClose={closeSheet}
        variant="drawer"
        aria-labelledby={`modules-sheet-${tenantId}`}
        panelClassName="flex h-full w-full max-w-lg shrink-0 flex-col overflow-hidden border-l border-foreground/10 bg-background shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-foreground/10 px-5 py-4">
          <div className="min-w-0">
            <h2 id={`modules-sheet-${tenantId}`} className="truncate text-base font-semibold text-foreground">
              Modules
            </h2>
            <p className="mt-0.5 truncate text-sm text-muted">{tenantName}</p>
            <p className="mt-0.5 font-mono text-[11px] text-muted">/{tenantSlug}</p>
          </div>
          <button
            type="button"
            onClick={closeSheet}
            disabled={pending}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-50"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setFeedback(null);
            startTransition(async () => {
              const res = await updateTenantModulesFromPlatform(tenantId, fd);
              if (res.ok) {
                setFeedback({ kind: "ok", message: "Modules saved." });
                setTimeout(() => closeSheet(), 600);
              } else {
                setFeedback({ kind: "error", message: res.error || "Could not save modules." });
              }
            });
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <p className="text-xs text-muted">
              Enable modules this organization has paid for. Disabled modules are hidden from their sidebar and routes — including all sub-pages listed below.
            </p>

            <div className="mt-4 space-y-5">
              {TENANT_MODULE_GROUPS.map((group) => {
                const items = TENANT_MODULE_DEFINITIONS.filter((d) => d.group === group.id);
                if (items.length === 0) return null;
                return (
                  <section key={group.id}>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">{group.label}</p>
                    <div className="space-y-1">
                      {items.map((def) => (
                        <ModuleCheckbox
                          key={def.key}
                          name={def.key}
                          label={def.label}
                          hint={def.description}
                          subpages={def.subpages}
                          defaultChecked={flags[def.key]}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>

          <div className="shrink-0 border-t border-foreground/10 bg-background px-5 py-4">
            {feedback ? (
              <p
                className={`mb-3 text-xs ${feedback.kind === "ok" ? "text-emerald-600" : "text-rose-600"}`}
              >
                {feedback.message}
              </p>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeSheet}
                disabled={pending}
                className="flex-1 rounded-md border border-foreground/15 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-foreground/[0.04] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                aria-busy={pending}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-foreground bg-foreground px-3 py-2.5 text-sm font-semibold text-background hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? <ButtonSpinner /> : null}
                {pending ? "Saving..." : "Save modules"}
              </button>
            </div>
          </div>
        </form>
      </ModalOverlay>
    </>
  );
}

function ModuleCheckbox({
  name,
  label,
  hint,
  subpages,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  subpages?: string[];
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-transparent px-2 py-2 hover:border-foreground/10 hover:bg-foreground/[0.03]">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 accent-foreground" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs leading-snug text-muted">{hint}</span> : null}
        {subpages && subpages.length > 0 ? (
          <span className="mt-1 block text-[11px] leading-snug text-muted/90">
            Sub-pages: {subpages.join(" · ")}
          </span>
        ) : null}
      </span>
    </label>
  );
}
