"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  platformRecordAndVerifyPayrollFunding,
  platformRejectPayrollFunding,
  platformSavePayrollDisbursementSettings,
  platformVerifyPayrollFunding,
} from "@/app/platform/actions";

export type PlatformFundingRow = {
  id: string;
  amountLabel: string;
  paymentReference: string;
  status: string;
  senderName: string | null;
  createdAtLabel: string;
  createdByLabel: string | null;
  verifiedAtLabel: string | null;
};

export type PlatformLedgerRow = {
  id: string;
  entryType: string;
  amountLabel: string;
  balanceAfterLabel: string;
  description: string;
  createdAtLabel: string;
};

type Props = {
  tenantSlug: string;
  tenantId: string;
  availableBalanceLabel: string;
  currency: string;
  pending: PlatformFundingRow[];
  recentLedger: PlatformLedgerRow[];
  feeFlatNaira: number;
  feePercentBps: number;
  feeCapNaira: number | "";
  fundingBankName: string;
  fundingAccountNumber: string;
  fundingAccountName: string;
  fundingAccountLabel: string;
};

export function PlatformPayrollFundingWorkspace(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setError(result.error || "Something went wrong.");
        return;
      }
      setMessage(result.message || "Saved.");
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-foreground/10 bg-background p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Payroll float</h2>
          <p className="mt-1 text-sm text-muted">
            Client funds Realcorp → you verify → Available balance on the ledger. No payout until
            Available covers salaries + fees.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-muted">Available</p>
          <p className="font-mono text-xl font-semibold text-foreground">
            {props.currency} {props.availableBalanceLabel}
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-md border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 rounded-md border border-foreground/10 bg-foreground/[0.03] px-3 py-2 text-sm text-foreground">
          {message}
        </p>
      ) : null}

      <form
        className="mt-5 grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          run(() =>
            platformRecordAndVerifyPayrollFunding({
              tenantSlug: props.tenantSlug,
              amount: String(fd.get("amount") || ""),
              paymentReference: String(fd.get("paymentReference") || ""),
              senderName: String(fd.get("senderName") || ""),
              senderBank: String(fd.get("senderBank") || ""),
              notes: String(fd.get("notes") || ""),
            }),
          );
        }}
      >
        <h3 className="sm:col-span-2 text-sm font-semibold text-foreground">
          Record &amp; verify inbound funding
        </h3>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Amount (NGN)</span>
          <input
            name="amount"
            required
            inputMode="decimal"
            placeholder="2500000.00"
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Payment reference</span>
          <input
            name="paymentReference"
            required
            placeholder="Unique bank narration / ref"
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Sender name</span>
          <input
            name="senderName"
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Sender bank</span>
          <input
            name="senderBank"
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-xs font-medium">Notes</span>
          <input
            name="notes"
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background disabled:opacity-50"
          >
            {pending ? "Working…" : "Credit Available balance"}
          </button>
          <p className="mt-1 text-xs text-muted">
            Only click after you have confirmed the money in Realcorp’s bank / PSP account.
          </p>
        </div>
      </form>

      {props.pending.length > 0 ? (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-foreground">Pending claims</h3>
          <ul className="mt-3 space-y-3">
            {props.pending.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-foreground/10 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-mono font-medium">
                    {props.currency} {row.amountLabel}
                  </p>
                  <p className="text-xs text-muted">
                    Ref {row.paymentReference}
                    {row.senderName ? ` · ${row.senderName}` : ""} · {row.createdAtLabel}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded-md border border-foreground/15 px-2.5 py-1 text-xs font-semibold"
                    onClick={() =>
                      run(() =>
                        platformVerifyPayrollFunding({
                          tenantSlug: props.tenantSlug,
                          receiptId: row.id,
                        }),
                      )
                    }
                  >
                    Verify
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="rounded-md border border-[var(--danger)]/30 px-2.5 py-1 text-xs font-semibold text-[var(--danger)]"
                    onClick={() => {
                      const reason = window.prompt("Rejection reason?");
                      if (!reason) return;
                      run(() =>
                        platformRejectPayrollFunding({
                          tenantSlug: props.tenantSlug,
                          receiptId: row.id,
                          reason,
                        }),
                      );
                    }}
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-8">
        <h3 className="text-sm font-semibold text-foreground">Recent ledger</h3>
        {props.recentLedger.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No ledger entries yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="pb-2 font-medium">When</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Balance after</th>
                  <th className="pb-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {props.recentLedger.map((row) => (
                  <tr key={row.id} className="border-t border-foreground/10">
                    <td className="py-2 text-xs text-muted">{row.createdAtLabel}</td>
                    <td className="py-2 font-mono text-xs">{row.entryType}</td>
                    <td className="py-2 font-mono">{row.amountLabel}</td>
                    <td className="py-2 font-mono">{row.balanceAfterLabel}</td>
                    <td className="py-2 text-muted">{row.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <form
        className="mt-8 grid gap-3 border-t border-foreground/10 pt-6 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const capRaw = String(fd.get("feeCapNaira") || "").trim();
          run(() =>
            platformSavePayrollDisbursementSettings({
              tenantSlug: props.tenantSlug,
              feeFlatNaira: Number(fd.get("feeFlatNaira") || 0),
              feePercentBps: Number(fd.get("feePercentBps") || 0),
              feeCapNaira: capRaw === "" ? undefined : Number(capRaw),
              fundingBankName: String(fd.get("fundingBankName") || ""),
              fundingAccountNumber: String(fd.get("fundingAccountNumber") || ""),
              fundingAccountName: String(fd.get("fundingAccountName") || ""),
              fundingAccountLabel: String(fd.get("fundingAccountLabel") || ""),
            }),
          );
        }}
      >
        <h3 className="sm:col-span-2 text-sm font-semibold text-foreground">
          Fee schedule &amp; funding instructions
        </h3>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Flat fee (₦ per payout)</span>
          <input
            name="feeFlatNaira"
            type="number"
            min={0}
            step="0.01"
            defaultValue={props.feeFlatNaira}
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Percent (basis points)</span>
          <input
            name="feePercentBps"
            type="number"
            min={0}
            step={1}
            defaultValue={props.feePercentBps}
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 font-mono text-sm"
          />
          <span className="mt-1 block text-xs text-muted">50 bps = 0.5%</span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Percent fee cap (₦, optional)</span>
          <input
            name="feeCapNaira"
            type="number"
            min={0}
            step="0.01"
            defaultValue={props.feeCapNaira === "" ? undefined : props.feeCapNaira}
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Funding label</span>
          <input
            name="fundingAccountLabel"
            defaultValue={props.fundingAccountLabel}
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Realcorp bank name</span>
          <input
            name="fundingBankName"
            defaultValue={props.fundingBankName}
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Realcorp account number</span>
          <input
            name="fundingAccountNumber"
            defaultValue={props.fundingAccountNumber}
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-xs font-medium">Account name</span>
          <input
            name="fundingAccountName"
            defaultValue={props.fundingAccountName}
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-foreground/15 px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Save settings
          </button>
        </div>
      </form>
    </section>
  );
}
