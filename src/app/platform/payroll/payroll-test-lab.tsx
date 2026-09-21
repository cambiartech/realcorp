"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  platformDisbursePayslipRun,
  platformPaystackStatus,
  platformResolveSalaryAccount,
} from "@/app/platform/actions";

export type PlatformDisburseRunOption = {
  tenantSlug: string;
  tenantName: string;
  runId: string;
  label: string;
  pendingCount: number;
  availableLabel: string;
  currency: string;
};

type Props = {
  appUrl: string;
  runs: PlatformDisburseRunOption[];
};

export function PlatformPayrollTestLab({ appUrl, runs }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [statusText, setStatusText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [resolveResult, setResolveResult] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState(runs[0]?.runId || "");

  function flash(ok: boolean, message: string) {
    setError(ok ? null : message);
    setStatusText(ok ? message : null);
  }

  return (
    <section className="mt-10 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Paystack test lab</h2>
        <p className="mt-1 text-sm text-muted">
          Super Admin only. Use test keys (`sk_test_…`) first. Real transfers debit Available float
          and the Paystack balance.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-[var(--danger-line)] bg-[var(--danger-wash)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      {statusText ? (
        <p className="rounded-md border border-[var(--success-line)] bg-[var(--success-wash)] px-3 py-2 text-sm text-[var(--success)]">
          {statusText}
        </p>
      ) : null}

      <div className="rounded-lg border border-foreground/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">1. Keys & Paystack balance</p>
            <p className="mt-0.5 text-xs text-muted">
              Webhook:{" "}
              <code className="font-mono text-[11px]">
                {appUrl.replace(/\/$/, "")}/api/webhooks/paystack
              </code>
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await platformPaystackStatus();
                if (!res.ok) {
                  flash(false, res.error);
                  return;
                }
                if (!res.configured) {
                  flash(
                    false,
                    "PAYSTACK_SECRET_KEY is missing. Add it to .env / Netlify and restart.",
                  );
                  return;
                }
                const bal =
                  res.balances.length > 0
                    ? res.balances.map((b) => `${b.currency} ${b.balanceLabel}`).join(", ")
                    : res.balanceError || "no balance rows";
                flash(
                  true,
                  `Configured (${res.keyMode}). Paystack balance: ${bal}. Paste webhook URL in Paystack Dashboard.`,
                );
              })
            }
            className="rounded-md border border-foreground bg-foreground px-3 py-2 text-xs font-semibold text-background disabled:opacity-50"
          >
            Check Paystack
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-foreground/10 p-4">
        <p className="text-sm font-semibold text-foreground">2. Resolve a NUBAN (name enquiry)</p>
        <p className="mt-0.5 text-xs text-muted">
          Confirms Paystack can see the account before any payout. Bank code e.g. 058 = GTBank.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="10-digit account"
            className="min-w-[160px] flex-1 rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
          />
          <input
            value={bankCode}
            onChange={(e) => setBankCode(e.target.value)}
            placeholder="Bank code"
            className="w-28 rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setResolveResult(null);
                const res = await platformResolveSalaryAccount({ accountNumber, bankCode });
                if (!res.ok) {
                  flash(false, res.error);
                  return;
                }
                setResolveResult(`${res.accountName} · ${res.accountNumber}`);
                flash(true, "Account resolved.");
              })
            }
            className="rounded-md border border-foreground/20 px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            Resolve
          </button>
        </div>
        {resolveResult ? <p className="mt-2 text-sm font-medium text-foreground">{resolveResult}</p> : null}
      </div>

      <div className="rounded-lg border border-foreground/10 p-4">
        <p className="text-sm font-semibold text-foreground">3. Disburse a published payroll run</p>
        <p className="mt-0.5 text-xs text-muted">
          Only FINALIZED runs with unpaid slips. Requires org Available float ≥ net + fees, staff
          bank codes, and funded Paystack balance. This sends real (or test-mode) transfers.
        </p>
        {runs.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No ready runs. Publish a payslip month with unpaid slips and verify float funding first.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="min-w-[240px] flex-1 text-xs">
              <span className="mb-1 block text-muted">Run</span>
              <select
                value={selectedRun}
                onChange={(e) => setSelectedRun(e.target.value)}
                className="w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
              >
                {runs.map((r) => (
                  <option key={r.runId} value={r.runId}>
                    {r.tenantName} · {r.label} · {r.pendingCount} unpaid · float {r.currency}{" "}
                    {r.availableLabel}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={pending || !selectedRun}
              onClick={() => {
                const run = runs.find((r) => r.runId === selectedRun);
                if (!run) return;
                if (
                  !window.confirm(
                    `Send Paystack transfers for ${run.tenantName} — ${run.label}? This moves money.`,
                  )
                ) {
                  return;
                }
                startTransition(async () => {
                  const res = await platformDisbursePayslipRun({
                    tenantSlug: run.tenantSlug,
                    payslipRunId: run.runId,
                  });
                  if (!res.ok) {
                    flash(false, res.error);
                    return;
                  }
                  flash(true, res.message);
                  router.refresh();
                });
              }}
              className="rounded-md border border-[var(--danger-line)] bg-[var(--danger)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              Disburse via Paystack
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
