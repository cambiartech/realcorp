import type { ProfileChecklistItem } from "@/lib/hr-profile-checklist";

export const ONBOARDING_STEPS = ["personal", "bank", "compliance", "activate"] as const;
export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

export function inferOnboardingStep(checklist: ProfileChecklistItem[]): OnboardingStepId {
  const done = (id: string) => checklist.find((i) => i.id === id)?.done ?? false;

  if (!done("biodata")) return "personal";
  if (!done("bank")) return "bank";

  const complianceIds = ["nda", "offer", "guarantor", "health", "emergency", "nextOfKin"];
  if (complianceIds.some((id) => !done(id))) return "compliance";

  return "activate";
}

export function onboardingStorageKey(tenantSlug: string, userId: string) {
  return `boerp-hr-onboard-step:${tenantSlug}:${userId}`;
}

export function readStoredOnboardingStep(tenantSlug: string, userId: string): OnboardingStepId | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(onboardingStorageKey(tenantSlug, userId));
    if (raw && ONBOARDING_STEPS.includes(raw as OnboardingStepId)) return raw as OnboardingStepId;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeStoredOnboardingStep(tenantSlug: string, userId: string, step: OnboardingStepId) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(onboardingStorageKey(tenantSlug, userId), step);
  } catch {
    /* ignore */
  }
}

export function resolveOnboardingStep(
  tenantSlug: string,
  userId: string,
  checklist: ProfileChecklistItem[],
): OnboardingStepId {
  const stored = readStoredOnboardingStep(tenantSlug, userId);
  const inferred = inferOnboardingStep(checklist);
  if (!stored) return inferred;

  const storedIdx = ONBOARDING_STEPS.indexOf(stored);
  const inferredIdx = ONBOARDING_STEPS.indexOf(inferred);
  return storedIdx >= inferredIdx ? stored : inferred;
}
