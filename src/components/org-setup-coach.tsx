"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2, X } from "lucide-react";
import {
  applySkippedToSteps,
  orgSetupProgress,
  skipAcknowledgement,
  type OrgSetupStep,
  type OrgSetupStepId,
} from "@/lib/org-setup-checklist";
import {
  findNewlyCompletedSteps,
  getNextIncompleteStep,
  readCelebratedSteps,
  readSkippedSteps,
  writeCelebratedSteps,
  writeSkippedSteps,
} from "@/lib/org-setup-coach-utils";

function pathMatchesStep(pathname: string, tab: string | null, step: OrgSetupStep): boolean {
  try {
    const url = new URL(step.href, "http://local");
    if (!pathname.startsWith(url.pathname)) return false;
    const stepTab = url.searchParams.get("tab");
    if (stepTab) return tab === stepTab;
    if (step.id === "currencies" || step.id === "bank_accounts" || step.id === "payment_modes") {
      return pathname.includes("/finance/settings");
    }
    return pathname === url.pathname;
  } catch {
    return false;
  }
}

/**
 * Stripe-style floating setup guide — bottom-right, progress bar, expandable checklist.
 */
export function OrgSetupCoach({
  tenantSlug,
  userId,
  tenantName,
  steps: serverSteps,
}: {
  tenantSlug: string;
  userId: string;
  tenantName: string;
  steps: OrgSetupStep[];
  percent?: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  const [collapsed, setCollapsed] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [skippedIds, setSkippedIds] = useState<OrgSetupStepId[]>([]);
  const [celebration, setCelebration] = useState<OrgSetupStep | null>(null);
  const [skipMessage, setSkipMessage] = useState<string | null>(null);
  const stepsSnapshotRef = useRef<OrgSetupStep[] | null>(null);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    setSkippedIds(readSkippedSteps(tenantSlug, userId));
  }, [tenantSlug, userId]);

  const steps = useMemo(() => applySkippedToSteps(serverSteps, skippedIds), [serverSteps, skippedIds]);
  const { percent } = useMemo(() => orgSetupProgress(steps), [steps]);
  const nextStep = useMemo(() => getNextIncompleteStep(steps), [steps]);
  const currentFocus = celebration && !skipMessage ? getNextIncompleteStep(steps) : nextStep;
  const onTargetPage = currentFocus ? pathMatchesStep(pathname, tab, currentFocus) : false;
  const allDone = !nextStep;

  useEffect(() => {
    if (!bootstrappedRef.current) {
      bootstrappedRef.current = true;
      stepsSnapshotRef.current = steps;
      return;
    }
    const prev = stepsSnapshotRef.current ?? steps;
    const newlyDone = findNewlyCompletedSteps(prev, steps).filter((s) => !s.skipped);
    stepsSnapshotRef.current = steps;
    if (newlyDone.length === 0) return;
    const celebrated = readCelebratedSteps(tenantSlug, userId);
    const toCelebrate = newlyDone.find((s) => !celebrated.includes(s.id));
    if (!toCelebrate) return;
    writeCelebratedSteps(tenantSlug, userId, [...celebrated, toCelebrate.id]);
    setSkipMessage(null);
    setCelebration(toCelebrate);
    setCollapsed(false);
  }, [steps, tenantSlug, userId]);

  useEffect(() => {
    if (!celebration && !skipMessage) return;
    const t = window.setTimeout(() => {
      setCelebration(null);
      setSkipMessage(null);
    }, 7000);
    return () => window.clearTimeout(t);
  }, [celebration, skipMessage]);

  function handleSkip(step: OrgSetupStep) {
    if (!step.skippable || step.done) return;
    const next = Array.from(new Set([...skippedIds, step.id]));
    setSkippedIds(next);
    writeSkippedSteps(tenantSlug, userId, next);
    setSkipMessage(skipAcknowledgement(step));
    setCelebration(step);
    setCollapsed(false);
  }

  if (allDone || dismissed) return null;

  const showSkip = currentFocus?.skippable && !currentFocus.done && !currentFocus.skipped;
  const headline = skipMessage
    ? "Okay, moving on"
    : celebration
      ? `Done — ${celebration.title}`
      : currentFocus
        ? currentFocus.title
        : "Finish setup";

  return (
    <div
      className={[
        "pointer-events-none fixed z-[55]",
        expanded
          ? "inset-x-3 bottom-16 top-auto md:inset-auto md:bottom-5 md:right-5 md:w-[380px]"
          : "bottom-16 right-3 w-[min(100vw-1.5rem,320px)] md:bottom-5 md:right-5",
      ].join(" ")}
      role="complementary"
      aria-label="Setup guide"
    >
      <div className="pointer-events-auto overflow-hidden rounded-xl border border-foreground/10 bg-background shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
        <div className="h-1 w-full bg-foreground/[0.06]">
          <div
            className="h-full bg-[var(--accent)] transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
          <p className="text-[13px] font-semibold text-foreground">Setup guide</p>
          <div className="flex items-center gap-0.5">
            <Link
              href={`/${tenantSlug}`}
              className="rounded px-2 py-1 text-[12px] font-medium text-muted hover:bg-foreground/[0.04] hover:text-foreground"
            >
              Edit
            </Link>
            <button
              type="button"
              onClick={() => {
                setExpanded((v) => !v);
                setCollapsed(false);
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-foreground/[0.04] hover:text-foreground"
              aria-label={expanded ? "Collapse setup guide" : "Expand setup guide"}
            >
              {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="inline-flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-foreground/[0.04] hover:text-foreground"
              aria-label="Dismiss setup guide"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {collapsed && !expanded ? (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="flex w-full items-center justify-between gap-2 border-t border-foreground/[0.06] px-3.5 py-2.5 text-left"
          >
            <span className="truncate text-[13px] text-muted">{headline}…</span>
            <span className="shrink-0 text-[11px] font-medium tabular-nums text-foreground">{percent}%</span>
          </button>
        ) : (
          <div className="border-t border-foreground/[0.06] px-3.5 pb-3.5 pt-2">
            <p className="text-[13px] font-medium text-foreground">{headline}</p>
            {skipMessage ? (
              <p className="mt-1 text-[12px] text-[var(--success)]">{skipMessage}</p>
            ) : celebration && !skipMessage ? (
              <p className="mt-1 text-[12px] text-[var(--success)]">
                Nice work on {tenantName}.
                {currentFocus ? (
                  <>
                    {" "}
                    Next: <span className="font-medium text-foreground">{currentFocus.title}</span>
                  </>
                ) : null}
              </p>
            ) : currentFocus ? (
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                {onTargetPage ? currentFocus.onPageHint : currentFocus.description}
              </p>
            ) : null}

            {expanded ? (
              <ul className="mt-3 max-h-56 space-y-0.5 overflow-y-auto">
                {steps.map((step) => {
                  const isFocus = currentFocus?.id === step.id;
                  return (
                    <li key={step.id}>
                      <Link
                        href={step.href}
                        className={[
                          "flex items-start gap-2 rounded-lg px-2 py-1.5 text-[12px] transition-colors",
                          isFocus ? "bg-[var(--accent)]/[0.08]" : "hover:bg-foreground/[0.04]",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                            step.done
                              ? "bg-[var(--success)]"
                              : isFocus
                                ? "bg-[var(--accent)]"
                                : "border border-foreground/25 bg-transparent",
                          ].join(" ")}
                          aria-hidden
                        />
                        <span
                          className={
                            step.done ? "text-muted line-through" : "font-medium text-foreground"
                          }
                        >
                          {step.title}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2">
              {currentFocus && !onTargetPage && !skipMessage ? (
                <Link
                  href={currentFocus.href}
                  className="rounded-md bg-foreground px-3 py-1.5 text-[12px] font-semibold text-background hover:opacity-90"
                >
                  {celebration ? "Continue" : "Get started"}
                </Link>
              ) : null}
              {showSkip && !skipMessage ? (
                <button
                  type="button"
                  onClick={() => handleSkip(currentFocus)}
                  className="rounded-md border border-foreground/12 px-3 py-1.5 text-[12px] font-medium text-muted hover:bg-foreground/[0.04] hover:text-foreground"
                >
                  Skip for now
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="rounded-md px-2 py-1.5 text-[12px] text-muted hover:text-foreground"
              >
                Minimize
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
