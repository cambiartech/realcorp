"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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

  const [collapsed, setCollapsed] = useState(false);
  const [skippedIds, setSkippedIds] = useState<OrgSetupStepId[]>([]);
  const [celebration, setCelebration] = useState<OrgSetupStep | null>(null);
  const [skipMessage, setSkipMessage] = useState<string | null>(null);
  const stepsSnapshotRef = useRef<OrgSetupStep[] | null>(null);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    setSkippedIds(readSkippedSteps(tenantSlug, userId));
  }, [tenantSlug, userId]);

  const steps = useMemo(
    () => applySkippedToSteps(serverSteps, skippedIds),
    [serverSteps, skippedIds],
  );

  const { percent } = useMemo(() => orgSetupProgress(steps), [steps]);

  const nextStep = useMemo(() => getNextIncompleteStep(steps), [steps]);
  const currentFocus = celebration && !skipMessage ? getNextIncompleteStep(steps) : nextStep;
  const onTargetPage = currentFocus ? pathMatchesStep(pathname, tab, currentFocus) : false;
  const stepIndex = currentFocus ? steps.findIndex((s) => s.id === currentFocus.id) + 1 : steps.length;
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

  if (allDone) {
    return null;
  }

  const showSkip = currentFocus?.skippable && !currentFocus.done && !currentFocus.skipped;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-16 z-[55] flex justify-center px-3 md:bottom-4 md:pl-56"
      role="complementary"
      aria-label="Organization setup coach"
    >
      <div
        className={[
          "pointer-events-auto w-full max-w-lg rounded-xl border shadow-2xl transition-all",
          celebration || skipMessage
            ? "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950"
            : "border-amber-500/35 bg-background",
        ].join(" ")}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-semibold text-foreground"
          >
            <span>Setup coach · {percent}%</span>
            <span className="text-xs text-muted">Expand</span>
          </button>
        ) : (
          <div className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                {/* <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                  Setup coach · optional steps can be skipped
                </p> */}
                <p className="mt-0.5 text-sm font-semibold text-foreground">
                  {skipMessage
                    ? "Okay, moving on"
                    : celebration
                      ? `Well done — ${celebration.title}`
                      : `Step ${stepIndex} of ${steps.length}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="shrink-0 rounded-md px-2 py-1 text-xs text-muted hover:bg-foreground/[0.06]"
                aria-label="Minimize setup coach"
              >
                —
              </button>
            </div>

            {skipMessage ? (
              <p className="mt-2 text-sm text-emerald-900 dark:text-emerald-100">
                {skipMessage}{" "}
                {currentFocus ? (
                  <>
                    Next: <strong>{currentFocus.title}</strong>.
                  </>
                ) : null}
              </p>
            ) : celebration && !skipMessage ? (
              <p className="mt-2 text-sm text-emerald-900 dark:text-emerald-100">
                Nice work setting up {tenantName}.{" "}
                {currentFocus ? (
                  <>
                    Next up: <strong>{currentFocus.title}</strong>.
                  </>
                ) : (
                  <>You&apos;re all set for now.</>
                )}
              </p>
            ) : currentFocus ? (
              <>
                <p className="mt-2 text-sm font-medium text-foreground">{currentFocus.title}</p>
                <p className="mt-1 text-xs text-muted">
                  {onTargetPage ? currentFocus.onPageHint : currentFocus.description}
                </p>
              </>
            ) : null}

            <div className="mt-3 h-1 overflow-hidden rounded-full bg-foreground/10">
              <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${percent}%` }} />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {currentFocus && !onTargetPage && !skipMessage ? (
                <Link
                  href={currentFocus.href}
                  className="rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90"
                >
                  {celebration ? "Continue →" : "Take me there →"}
                </Link>
              ) : null}
              {showSkip && !skipMessage ? (
                <button
                  type="button"
                  onClick={() => handleSkip(currentFocus)}
                  className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-foreground/[0.06]"
                >
                  Skip for now
                </button>
              ) : null}
              {onTargetPage && showSkip && !skipMessage ? (
                <p className="self-center text-xs text-muted">Or skip if you&apos;ll do this later.</p>
              ) : null}
              <Link
                href={`/${tenantSlug}`}
                className="rounded-md border border-foreground/15 px-3 py-1.5 text-xs text-foreground hover:bg-foreground/[0.06]"
              >
                View checklist
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
