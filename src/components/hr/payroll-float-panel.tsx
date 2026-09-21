"use client";

import { useState } from "react";
import { Check, Copy, Landmark, Wallet } from "lucide-react";

type Props = {
  currency: string;
  availableBalanceLabel: string;
  fundingOpen: boolean;
  onToggleFunding: () => void;
  fundingForm: React.ReactNode;
  dvaAccountNumber?: string;
  dvaBankName?: string;
  dvaAccountName?: string;
  dvaPurpose?: string;
  fundingBankName?: string;
  fundingAccountNumber?: string;
  fundingAccountName?: string;
  fundingAccountLabel?: string;
};

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-foreground/10 bg-background px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
        <p className="mt-0.5 truncate font-mono text-sm font-semibold text-foreground">{value}</p>
      </div>
      <button
        type="button"
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-foreground/10 px-2 py-1 text-[11px] font-semibold text-muted hover:bg-foreground/[0.04] hover:text-foreground"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          } catch {
            /* ignore */
          }
        }}
      >
        {copied ? <Check className="h-3 w-3 text-[var(--success)]" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function PayrollFloatPanel({
  currency,
  availableBalanceLabel,
  fundingOpen,
  onToggleFunding,
  fundingForm,
  dvaAccountNumber = "",
  dvaBankName = "",
  dvaAccountName = "",
  dvaPurpose = "",
  fundingBankName = "",
  fundingAccountNumber = "",
  fundingAccountName = "",
  fundingAccountLabel = "",
}: Props) {
  const hasDva = Boolean(dvaAccountNumber);
  const hasFallback = Boolean(fundingAccountNumber || fundingBankName);
  const purposeLabel =
    dvaPurpose === "INVESTOR" ? "Investor funding account" : "Payroll funding account";

  return (
    <section className="overflow-hidden rounded-2xl border border-foreground/10 bg-background shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
        <div className="relative overflow-hidden border-b border-foreground/10 bg-[linear-gradient(145deg,var(--foreground)_0%,color-mix(in_srgb,var(--foreground)_88%,transparent)_100%)] p-5 text-background lg:border-b-0 lg:border-r">
          <div
            className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-background/10 blur-2xl"
            aria-hidden
          />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-background/70">
                <Wallet className="h-3.5 w-3.5" />
                Available float
              </p>
              <p className="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
                <span className="mr-2 text-lg font-semibold text-background/60">{currency}</span>
                {availableBalanceLabel}
              </p>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-background/75">
                Transfer into the account on the right, then tell us the reference. Balance updates after
                Realcorp verifies — not when you submit the claim.
              </p>
            </div>
          </div>
          <ol className="relative mt-6 grid gap-2 text-[12px] text-background/80 sm:grid-cols-3">
            {[
              "1 · Copy account",
              "2 · Transfer funds",
              "3 · Submit reference",
            ].map((step) => (
              <li
                key={step}
                className="rounded-lg border border-background/15 bg-background/10 px-3 py-2 font-medium backdrop-blur-sm"
              >
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                <Landmark className="h-3.5 w-3.5" />
                {hasDva ? purposeLabel : fundingAccountLabel || "Funding account"}
              </p>
              <p className="mt-1 text-sm text-muted">
                {hasDva
                  ? "Dedicated virtual account for this organization."
                  : hasFallback
                    ? "Use these Realcorp bank details until a dedicated account is assigned."
                    : "Realcorp has not published funding details for this org yet."}
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleFunding}
              className="rounded-lg border border-foreground bg-foreground px-3 py-2 text-xs font-semibold text-background transition hover:opacity-90"
            >
              {fundingOpen ? "Hide claim" : "I transferred funds"}
            </button>
          </div>

          {hasDva || hasFallback ? (
            <div className="space-y-2">
              {hasDva ? (
                <>
                  <CopyField label="Bank" value={dvaBankName} />
                  <CopyField label="Account number" value={dvaAccountNumber} />
                  <CopyField label="Account name" value={dvaAccountName} />
                </>
              ) : (
                <>
                  <CopyField label="Bank" value={fundingBankName} />
                  <CopyField label="Account number" value={fundingAccountNumber} />
                  <CopyField label="Account name" value={fundingAccountName} />
                </>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-foreground/15 bg-foreground/[0.02] px-4 py-6 text-center text-sm text-muted">
              Ask Realcorp Super Admin to attach this org’s Dedicated Virtual Account.
            </div>
          )}

          {fundingOpen ? <div className="border-t border-foreground/10 pt-4">{fundingForm}</div> : null}
        </div>
      </div>
    </section>
  );
}
