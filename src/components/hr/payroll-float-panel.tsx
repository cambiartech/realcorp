"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, RefreshCw } from "lucide-react";
import { refreshPayrollFloat } from "@/app/[tenantSlug]/hr/actions";
import { useSnackbar } from "@/components/snackbar";

type Props = {
  tenantSlug: string;
  currency: string;
  availableBalanceLabel: string;
  dvaAccountNumber?: string;
  dvaBankName?: string;
  dvaAccountName?: string;
  fundingBankName?: string;
  fundingAccountNumber?: string;
  fundingAccountName?: string;
};

export function PayrollFloatPanel({
  tenantSlug,
  currency,
  availableBalanceLabel,
  dvaAccountNumber = "",
  dvaBankName = "",
  dvaAccountName = "",
  fundingBankName = "",
  fundingAccountNumber = "",
  fundingAccountName = "",
}: Props) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [balanceLabel, setBalanceLabel] = useState(availableBalanceLabel);
  const hasDva = Boolean(dvaAccountNumber);
  const bankName = hasDva ? dvaBankName : fundingBankName;
  const accountNumber = hasDva ? dvaAccountNumber : fundingAccountNumber;
  const accountName = hasDva ? dvaAccountName : fundingAccountName;

  function refresh() {
    startTransition(async () => {
      const res = await refreshPayrollFloat(tenantSlug);
      if (!res.ok) {
        showSnackbar(res.error || "Could not refresh float.", "error");
        return;
      }
      if (res.availableLabel) setBalanceLabel(res.availableLabel);
      if ((res.credited ?? 0) > 0) {
        showSnackbar(
          `${res.credited} DVA deposit${res.credited === 1 ? "" : "s"} credited to Available.`,
          "success",
        );
      }
      router.refresh();
    });
  }

  async function copyAccount() {
    if (!accountNumber) return;
    try {
      await navigator.clipboard.writeText(accountNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard can be blocked */
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-foreground/10 bg-foreground text-background shadow-sm">
      <div className="flex items-start justify-between gap-4 px-5 pb-2 pt-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-background/60">
            Available float
          </p>
          <p className="mt-1 max-w-sm text-xs text-background/55">
            Fund this org’s DVA → we credit Available → Pay sends from Paystack Balance and debits
            this float.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full border border-background/20 px-3 py-1.5 text-xs font-semibold text-background/90 transition hover:bg-background/10 disabled:opacity-60"
        >
          <RefreshCw className={pending ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          {pending ? "Syncing" : "Refresh"}
        </button>
      </div>
      <p className="px-5 font-mono text-4xl font-semibold tracking-tight">
        <span className="mr-2 text-lg font-medium text-background/55">{currency}</span>
        {balanceLabel}
      </p>
      {accountNumber ? (
        <div className="mt-6 flex items-end justify-between gap-4 border-t border-background/10 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs text-background/60">{bankName || "Account"}</p>
            <p className="mt-1 font-mono text-lg tracking-wide">{accountNumber}</p>
            {accountName ? <p className="mt-0.5 truncate text-sm text-background/75">{accountName}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => void copyAccount()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-background/20 px-3 py-1.5 text-xs font-semibold text-background/90 transition hover:bg-background/10"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : (
        <p className="mt-6 border-t border-background/10 px-5 py-4 text-sm text-background/70">
          No payroll account on this organization yet.
        </p>
      )}
    </section>
  );
}
