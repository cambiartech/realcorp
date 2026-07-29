/**
 * Product-critical org setup steps shown to new org admins after signup.
 * Completion uses sensible defaults — no redundant "confirm save" when data is already present.
 */

import { mergeCurrencyOptions } from "@/lib/finance-catalog";

export type OrgSetupStepId =
  | "org_name"
  | "currencies"
  | "bank_accounts"
  | "payment_modes"
  | "logo_branding"
  | "invite_team"
  | "fiscal_goals";

export type OrgSetupStep = {
  id: OrgSetupStepId;
  title: string;
  description: string;
  /** Shown when user is already on the target page */
  onPageHint: string;
  href: string;
  done: boolean;
  /** Blocks "all required setup complete" on server — only true must-haves */
  critical: boolean;
  /** User can skip for now; coach moves on without saving */
  skippable: boolean;
  /** Set client-side when user skipped */
  skipped?: boolean;
};

export type OrgSetupInput = {
  tenantSlug: string;
  tenantName: string;
  defaultCurrency: string;
  logoUrl: string | null;
  orgEmail: string | null;
  orgPhone: string | null;
  financeCurrencies: unknown;
  financeBankAccounts: unknown;
  financePaymentModes: unknown;
  moduleFinance: boolean;
  activeMemberCount: number;
  pendingInviteCount: number;
  hasActiveFiscalGoal: boolean;
};

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

export function buildOrgSetupSteps(input: OrgSetupInput): OrgSetupStep[] {
  const bankAccounts = asStringList(input.financeBankAccounts);
  const paymentModes = asStringList(input.financePaymentModes);

  const orgName = input.tenantName.trim();
  const orgNameDone = orgName.length >= 2;

  const effectiveCurrencies = mergeCurrencyOptions(input.financeCurrencies, input.defaultCurrency);
  const currenciesDone = effectiveCurrencies.length > 0;

  const bankDone = bankAccounts.length > 0;
  const paymentModesDone = paymentModes.length > 0;
  const logoDone = Boolean(input.logoUrl?.trim());
  const contactDone = Boolean(input.orgEmail?.trim() || input.orgPhone?.trim());
  const teamDone = input.activeMemberCount > 1 || input.pendingInviteCount > 0;

  const currencySummary =
    effectiveCurrencies.length === 1
      ? `${effectiveCurrencies[0]} looks good — add more only if you need them.`
      : `${effectiveCurrencies.join(", ")} are set. Add or remove currencies anytime in Finance settings.`;

  const steps: OrgSetupStep[] = [
    {
      id: "org_name",
      title: orgNameDone ? "Organization name" : "Set organization name",
      description: orgNameDone
        ? `"${orgName}" is already set — no need to save again unless you want to change it.`
        : "Enter your company name as clients and staff should see it.",
      onPageHint: orgNameDone
        ? `You're all set with "${orgName}". Change it below only if needed, then Save.`
        : "Enter your organization name, then click Save organization name.",
      href: `/${input.tenantSlug}/settings?tab=organization`,
      done: orgNameDone,
      critical: !orgNameDone,
      skippable: false,
    },
    {
      id: "logo_branding",
      title: "Upload logo & branding",
      description: contactDone
        ? "Logo and contact details are set for payslips and HR documents."
        : "Upload your logo, pick brand colors, and add a company email or phone — then Save branding.",
      onPageHint: contactDone
        ? "Upload or change your logo and colors, then Save branding."
        : "Upload your logo, add HR email or phone, then click Save branding.",
      href: `/${input.tenantSlug}/settings?tab=organization`,
      done: logoDone,
      critical: false,
      skippable: true,
    },
    {
      id: "currencies",
      title: currenciesDone ? "Currencies" : "Set finance currencies",
      description: currenciesDone
        ? currencySummary
        : "Add at least one currency (e.g. NGN), then Save finance settings.",
      onPageHint: currenciesDone
        ? `${currencySummary} Click Save finance settings only if you changed the list.`
        : "Add at least one currency, then click Save finance settings at the bottom.",
      href: `/${input.tenantSlug}/finance/settings`,
      done: currenciesDone,
      critical: false,
      skippable: true,
    },
  ];

  if (input.moduleFinance) {
    steps.push(
      {
        id: "bank_accounts",
        title: "Add bank / cash accounts",
        description:
          "When you're ready, add accounts you receive payments into. You can skip and do this later — nothing is blocked.",
        onPageHint: "Add bank details when you want, then Save finance settings — or tap Skip for now below.",
        href: `/${input.tenantSlug}/finance/settings`,
        done: bankDone,
        critical: false,
        skippable: true,
      },
      {
        id: "payment_modes",
        title: "Add payment modes",
        description: "Your defaults may already cover you. Add more anytime, or skip for now.",
        onPageHint: "Review payment modes, or skip if the defaults work for you.",
        href: `/${input.tenantSlug}/finance/settings`,
        done: paymentModesDone,
        critical: false,
        skippable: true,
      },
    );
  }

  steps.push(
    {
      id: "invite_team",
      title: "Invite your team",
      description: "Add sales, finance, and managers so work does not sit with one login.",
      onPageHint: "Create an invite link for your first teammate.",
      href: `/${input.tenantSlug}/team`,
      done: teamDone,
      critical: false,
      skippable: true,
    },
    {
      id: "fiscal_goals",
      title: "Set fiscal year goals (optional)",
      description: "Revenue and pipeline targets power dashboard attainment charts.",
      onPageHint: "Set revenue target (pipeline target is optional), or skip for now.",
      href: `/${input.tenantSlug}?openGoals=1`,
      done: input.hasActiveFiscalGoal,
      critical: false,
      skippable: true,
    },
  );

  return steps;
}

/** Treat skipped steps as complete for coach progression (client-side). */
export function applySkippedToSteps(steps: OrgSetupStep[], skippedIds: OrgSetupStepId[]): OrgSetupStep[] {
  const skip = new Set(skippedIds);
  return steps.map((s) => (skip.has(s.id) ? { ...s, done: true, skipped: true } : s));
}

export function orgSetupProgress(steps: OrgSetupStep[]) {
  const critical = steps.filter((s) => s.critical);
  const criticalDone = critical.filter((s) => s.done).length;
  const completedCount = steps.filter((s) => s.done).length;
  return {
    steps,
    criticalTotal: critical.length,
    criticalDone,
    criticalComplete: critical.length === 0 || criticalDone === critical.length,
    total: steps.length,
    completed: completedCount,
    percent: steps.length ? Math.round((completedCount / steps.length) * 100) : 100,
  };
}

export function skipAcknowledgement(step: OrgSetupStep): string {
  switch (step.id) {
    case "bank_accounts":
      return "No problem — add bank accounts anytime under Finance → Settings.";
    case "payment_modes":
      return "Sounds good — you can tweak payment modes later if needed.";
    case "logo_branding":
      return "Okay — you can upload branding whenever you're ready.";
    case "invite_team":
      return "Got it — invite teammates from Team when you're ready.";
    case "fiscal_goals":
      return "All good — set fiscal goals from your dashboard anytime.";
    case "currencies":
      return "Okay — currencies are fine for now.";
    default:
      return "Skipped for now — you can come back to this anytime.";
  }
}

export function orgSetupStorageKey(tenantSlug: string, userId: string) {
  return `realcorp_org_setup_intro_v1_${tenantSlug}_${userId}`;
}
