import type { OrgSetupStep, OrgSetupStepId } from "@/lib/org-setup-checklist";

export function getNextIncompleteStep(steps: OrgSetupStep[]): OrgSetupStep | null {
  return steps.find((s) => !s.done && !s.skipped) ?? null;
}

export function skippedStepsKey(tenantSlug: string, userId: string) {
  return `realcorp_org_setup_skipped_v1_${tenantSlug}_${userId}`;
}

export function readSkippedSteps(tenantSlug: string, userId: string): OrgSetupStepId[] {
  try {
    const raw = localStorage.getItem(skippedStepsKey(tenantSlug, userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed.filter((x) => typeof x === "string") as OrgSetupStepId[]) : [];
  } catch {
    return [];
  }
}

export function writeSkippedSteps(tenantSlug: string, userId: string, ids: OrgSetupStepId[]) {
  try {
    localStorage.setItem(skippedStepsKey(tenantSlug, userId), JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export function stepMatchesPath(step: OrgSetupStep, pathname: string): boolean {
  try {
    const url = new URL(step.href, "http://local");
    const path = url.pathname;
    const tab = url.searchParams.get("tab");
    if (pathname === path) {
      if (!tab) return true;
      if (typeof window !== "undefined") {
        const currentTab = new URLSearchParams(window.location.search).get("tab");
        return currentTab === tab;
      }
      return pathname.includes("/settings") && tab === "organization";
    }
    if (step.id === "currencies" || step.id === "bank_accounts" || step.id === "payment_modes") {
      return pathname.includes("/finance/settings");
    }
    return false;
  } catch {
    return false;
  }
}

export function celebratedStepsKey(tenantSlug: string, userId: string) {
  return `realcorp_org_setup_celebrated_v2_${tenantSlug}_${userId}`;
}

export function readCelebratedSteps(tenantSlug: string, userId: string): OrgSetupStepId[] {
  try {
    const raw = localStorage.getItem(celebratedStepsKey(tenantSlug, userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed.filter((x) => typeof x === "string") as OrgSetupStepId[]) : [];
  } catch {
    return [];
  }
}

export function writeCelebratedSteps(tenantSlug: string, userId: string, ids: OrgSetupStepId[]) {
  try {
    localStorage.setItem(celebratedStepsKey(tenantSlug, userId), JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export function findNewlyCompletedSteps(previous: OrgSetupStep[], current: OrgSetupStep[]): OrgSetupStep[] {
  const prevDone = new Set(previous.filter((s) => s.done).map((s) => s.id));
  return current.filter((s) => s.done && !prevDone.has(s.id));
}
