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
  feeBaseNaira: number;
  feePercentBps: number;
  feeCapNaira: number | "";
  fundingBankName: string;
  fundingAccountNumber: string;
  fundingAccountName: string;
  fundingAccountLabel: string;
  dvaProvider: string;
  dvaAccountNumber: string;
  dvaBankName: string;
  dvaAccountName: string;
  dvaBankCode: string;
  dvaProviderAccountId: string;
  dvaCustomerCode: string;
  dvaPurpose: string;
  dvaNotes: string;
  requirePlatformApproval: boolean;
  view: "payroll" | "settings";
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
    <section id="payroll-float" className="scroll-mt-6 rounded-lg border border-foreground/10 bg-background p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {props.view === "settings" ? "Payroll settings" : "Payroll float"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {props.view === "settings"
              ? "These numbers are what this organization pays Realcorp. HR sees them on Pay via Paystack."
              : "Client funds Realcorp → you verify → Available balance on the ledger. No payout until Available covers salaries + fees."}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-muted">Available</p>
          <p className="font-mono text-xl font-semibold text-foreground">
            {props.currency} {props.availableBalanceLabel}
          </p>
        </div>
      </div>

      {props.view === "settings" ? (
      <form
        className="mt-4 grid gap-3 rounded-lg border border-foreground/15 bg-foreground/[0.03] px-3 py-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const capRaw = String(fd.get("feeCapNaira") || "").trim();
          run(() =>
            platformSavePayrollDisbursementSettings({
              tenantSlug: props.tenantSlug,
              feeFlatNaira: Number(fd.get("feeFlatNaira") || 0),
              feeBaseNaira: Number(fd.get("feeBaseNaira") || 0),
              feePercentBps: Number(fd.get("feePercentBps") || 0),
              feeCapNaira: capRaw === "" ? undefined : Number(capRaw),
              fundingBankName: props.fundingBankName,
              fundingAccountNumber: props.fundingAccountNumber,
              fundingAccountName: props.fundingAccountName,
              fundingAccountLabel: props.fundingAccountLabel,
              dvaProvider: (props.dvaProvider || "PAYSTACK") as "PAYSTACK" | "FLUTTERWAVE" | "",
              dvaAccountNumber: props.dvaAccountNumber,
              dvaBankName: props.dvaBankName,
              dvaAccountName: props.dvaAccountName,
              dvaBankCode: props.dvaBankCode,
              dvaProviderAccountId: props.dvaProviderAccountId,
              dvaCustomerCode: props.dvaCustomerCode,
              dvaPurpose: props.dvaPurpose,
              dvaNotes: props.dvaNotes,
              requirePlatformApproval: String(fd.get("requirePlatformApproval") || "") === "yes",
            }),
          );
        }}
      >
        <div className="sm:col-span-2">
          <p className="text-sm font-semibold text-foreground">Approval and Realcorp fee</p>
          <p className="mt-1 text-xs text-muted">
            {props.requirePlatformApproval
              ? "Approval is on. Pay waits until a platform admin approves."
              : "Approval is off, so Pay sends immediately. Per person ₦" +
                props.feeFlatNaira.toLocaleString("en-NG") +
                ". Base ₦" +
                props.feeBaseNaira.toLocaleString("en-NG") +
                " once per payroll."}
          </p>
        </div>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-xs font-medium">Wait for Realcorp before Paystack</span>
          <select
            name="requirePlatformApproval"
            defaultValue={props.requirePlatformApproval ? "yes" : "no"}
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          >
            <option value="no">No — send immediately</option>
            <option value="yes">Yes — wait for Realcorp</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Realcorp fee (₦ per person)</span>
          <input
            name="feeFlatNaira"
            type="number"
            min={0}
            step="0.01"
            defaultValue={props.feeFlatNaira}
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 font-mono text-sm"
          />
          <span className="mt-1 block text-xs text-muted">
            Your charge on each salary. A ₦50,000 salary still pays this when Paystack charges ₦100. Type 100 to keep ₦100 per person.
          </span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Base fee (₦ once per payroll)</span>
          <input
            name="feeBaseNaira"
            type="number"
            min={0}
            step="0.01"
            defaultValue={props.feeBaseNaira}
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 font-mono text-sm"
          />
          <span className="mt-1 block text-xs text-muted">
            Optional. Type 30000 to charge ₦30,000 once each payroll, on top of the per-person fee. It returns if nobody is paid.
          </span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Percent (basis points, optional)</span>
          <input
            name="feePercentBps"
            type="number"
            min={0}
            step={1}
            defaultValue={props.feePercentBps}
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 font-mono text-sm"
          />
          <span className="mt-1 block text-xs text-muted">0 recommended. 100 bps = 1% of the salary.</span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Percent cap (₦, optional)</span>
          <input
            name="feeCapNaira"
            type="number"
            min={0}
            step="0.01"
            defaultValue={props.feeCapNaira === "" ? undefined : props.feeCapNaira}
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 font-mono text-sm"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-foreground bg-foreground px-3 py-2 text-xs font-semibold text-background disabled:opacity-50"
          >
            Save approval and fee
          </button>
        </div>
      </form>
      ) : null}

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

      {props.view === "payroll" ? (
      <>
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
      </>
      ) : null}

      {props.view === "settings" ? (
      <form
        className="mt-8 grid gap-3 border-t border-foreground/10 pt-6 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          run(() =>
            platformSavePayrollDisbursementSettings({
              tenantSlug: props.tenantSlug,
              feeFlatNaira: props.feeFlatNaira,
              feeBaseNaira: props.feeBaseNaira,
              feePercentBps: props.feePercentBps,
              feeCapNaira: props.feeCapNaira === "" ? undefined : props.feeCapNaira,
              fundingBankName: String(fd.get("fundingBankName") || ""),
              fundingAccountNumber: String(fd.get("fundingAccountNumber") || ""),
              fundingAccountName: String(fd.get("fundingAccountName") || ""),
              fundingAccountLabel: String(fd.get("fundingAccountLabel") || ""),
              dvaProvider: (String(fd.get("dvaProvider") || "PAYSTACK") as
                | "PAYSTACK"
                | "FLUTTERWAVE"
                | "") || "PAYSTACK",
              dvaAccountNumber: String(fd.get("dvaAccountNumber") || ""),
              dvaBankName: String(fd.get("dvaBankName") || ""),
              dvaAccountName: String(fd.get("dvaAccountName") || ""),
              dvaBankCode: String(fd.get("dvaBankCode") || ""),
              dvaProviderAccountId: String(fd.get("dvaProviderAccountId") || ""),
              dvaCustomerCode: String(fd.get("dvaCustomerCode") || ""),
              dvaPurpose: String(fd.get("dvaPurpose") || "PAYROLL_FLOAT"),
              dvaNotes: String(fd.get("dvaNotes") || ""),
              requirePlatformApproval: props.requirePlatformApproval,
            }),
          );
        }}
      >
        <h3 className="sm:col-span-2 text-sm font-semibold text-foreground">
          Funding account
        </h3>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Funding label</span>
          <input
            name="fundingAccountLabel"
            defaultValue={props.fundingAccountLabel}
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Fallback bank name</span>
          <input
            name="fundingBankName"
            defaultValue={props.fundingBankName}
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Fallback account number</span>
          <input
            name="fundingAccountNumber"
            defaultValue={props.fundingAccountNumber}
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-xs font-medium">Fallback account name</span>
          <input
            name="fundingAccountName"
            defaultValue={props.fundingAccountName}
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </label>

        <div className="sm:col-span-2 mt-2 border-t border-foreground/10 pt-5">
          <h3 className="text-sm font-semibold text-foreground">
            Dedicated Virtual Account (per tenant)
          </h3>
          <p className="mt-1 text-xs text-muted">
            Paste the account number from Paystack. That is enough. Customer code and dedicated
            account id can stay blank. A transfer to that account credits this org’s available float.
            Webhook: https://realcoerp.com/api/webhooks/paystack.
          </p>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Provider</span>
          <select
            name="dvaProvider"
            defaultValue={props.dvaProvider || "PAYSTACK"}
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          >
            <option value="PAYSTACK">Paystack</option>
            <option value="FLUTTERWAVE">Flutterwave</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Purpose</span>
          <select
            name="dvaPurpose"
            defaultValue={props.dvaPurpose || "PAYROLL_FLOAT"}
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          >
            <option value="PAYROLL_FLOAT">Payroll float</option>
            <option value="INVESTOR">Investor / capital</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">DVA account number</span>
          <input
            name="dvaAccountNumber"
            defaultValue={props.dvaAccountNumber}
            placeholder="From Paystack Virtual Accounts"
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">DVA bank name</span>
          <input
            name="dvaBankName"
            defaultValue={props.dvaBankName}
            placeholder="e.g. Wema Bank"
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">DVA account name</span>
          <input
            name="dvaAccountName"
            defaultValue={props.dvaAccountName}
            placeholder="Usually Realcorp / tenant slug"
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">DVA bank code (optional)</span>
          <input
            name="dvaBankCode"
            defaultValue={props.dvaBankCode}
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Paystack dedicated account id</span>
          <input
            name="dvaProviderAccountId"
            defaultValue={props.dvaProviderAccountId}
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium">Paystack customer code</span>
          <input
            name="dvaCustomerCode"
            defaultValue={props.dvaCustomerCode}
            className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 font-mono text-sm"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-xs font-medium">Notes (internal)</span>
          <input
            name="dvaNotes"
            defaultValue={props.dvaNotes}
            placeholder="e.g. Created 21 Sep for BO Properties payroll"
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
      ) : null}
    </section>
  );
}
