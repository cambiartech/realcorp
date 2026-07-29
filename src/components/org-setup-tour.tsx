"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MODAL_PANEL_MD } from "@/lib/modal-panel";
import { ModalOverlay } from "@/components/modal-overlay";
import { orgSetupStorageKey, type OrgSetupStep } from "@/lib/org-setup-checklist";

export function OrgSetupTour({
  tenantSlug,
  userId,
  tenantName,
  steps,
  criticalComplete,
  percent,
}: {
  tenantSlug: string;
  userId: string;
  tenantName: string;
  steps: OrgSetupStep[];
  criticalComplete: boolean;
  percent: number;
}) {
  const storageKey = orgSetupStorageKey(tenantSlug, userId);
  const [modalOpen, setModalOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const incompleteCritical = useMemo(() => steps.filter((s) => s.critical && !s.done), [steps]);

  useEffect(() => {
    if (criticalComplete) return;
    try {
      const seen = localStorage.getItem(storageKey);
      if (!seen) {
        setModalOpen(true);
        localStorage.setItem(storageKey, new Date().toISOString());
      }
    } catch {
      setModalOpen(true);
    }
  }, [criticalComplete, storageKey]);

  if (criticalComplete && steps.every((s) => s.done)) {
    return null;
  }

  return (
    <>
      {!bannerDismissed ? (
        <div
          role="status"
          className="mb-4 rounded-xl border border-[var(--warn-line)] bg-gradient-to-r from-[var(--warn-wash)] via-[var(--warn-wash)] to-transparent px-4 py-3 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Finish setting up {tenantName}</p>
              <p className="mt-0.5 text-xs text-muted">
                {criticalComplete
                  ? `${percent}% complete — optional steps remain for a smoother rollout.`
                  : `${incompleteCritical.length} required step${incompleteCritical.length === 1 ? "" : "s"} left before finance & reporting work properly.`}
              </p>
              <div className="mt-2 h-1.5 max-w-xs overflow-hidden rounded-full bg-foreground/10">
                <div
                  className="h-full rounded-full bg-[var(--warn)] transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90"
              >
                Open setup guide
              </button>
              {criticalComplete ? (
                <button
                  type="button"
                  onClick={() => setBannerDismissed(true)}
                  className="rounded-md border border-foreground/15 px-3 py-1.5 text-xs text-muted hover:bg-foreground/[0.06]"
                >
                  Dismiss
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <ModalOverlay
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        zClassName="z-[60]"
        panelClassName={`${MODAL_PANEL_MD} flex max-h-[min(90vh,640px)] flex-col overflow-hidden p-0`}
        aria-labelledby="org-setup-title"
      >
        <div className="shrink-0 border-b border-foreground/10 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="org-setup-title" className="text-lg font-semibold text-foreground">
                Welcome — let&apos;s configure {tenantName}
              </h2>
              <p className="mt-1 text-sm text-muted">
                These settings power currencies on your dashboard, finance forms, and branded documents. Start
                with the required steps, then invite your team.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06]"
              aria-label="Close setup guide"
            >
              ×
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted">
            <span className="font-medium text-foreground">{percent}%</span>
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full rounded-full bg-foreground transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>

        <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {steps.map((step, index) => (
            <li
              key={step.id}
              className={[
                "rounded-lg border px-3 py-2.5",
                step.done
                  ? "border-[var(--success-line)] bg-[var(--success-wash)]"
                  : step.critical
                    ? "border-[var(--warn-line)] bg-[var(--warn)]/[0.06]"
                    : "border-foreground/10 bg-foreground/[0.02]",
              ].join(" ")}
            >
              <div className="flex items-start gap-2">
                <span
                  className={[
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    step.done ? "bg-[var(--success)] text-white" : "bg-foreground/10 text-muted",
                  ].join(" ")}
                  aria-hidden
                >
                  {step.done ? "✓" : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{step.title}</p>
                    {step.critical && !step.done ? (
                      <span className="rounded-full bg-[var(--warn-wash)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--warn)]">
                        Required
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted">{step.description}</p>
                  {!step.done ? (
                    <Link
                      href={step.href}
                      onClick={() => setModalOpen(false)}
                      className="mt-2 inline-flex text-xs font-semibold text-foreground underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground"
                    >
                      Go to setup →
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>

        <div className="shrink-0 flex justify-end gap-2 border-t border-foreground/10 px-5 py-3">
          <button
            type="button"
            onClick={() => setModalOpen(false)}
            className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
          >
            {criticalComplete ? "Close" : "Finish later"}
          </button>
          {incompleteCritical[0] ? (
            <Link
              href={incompleteCritical[0].href}
              onClick={() => setModalOpen(false)}
              className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90"
            >
              Start: {incompleteCritical[0].title}
            </Link>
          ) : null}
        </div>
      </ModalOverlay>
    </>
  );
}
