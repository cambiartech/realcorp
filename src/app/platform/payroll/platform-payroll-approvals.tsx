"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { platformApprovePayrollBatch } from "@/app/platform/actions";

export type PlatformPayrollApprovalRow = {
  batchId: string;
  tenantName: string;
  tenantSlug: string;
  periodLabel: string;
  staffCount: number;
  amountLabel: string;
  currency: string;
  createdAtLabel: string;
};

export function PlatformPayrollApprovals({ rows }: { rows: PlatformPayrollApprovalRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (rows.length === 0) return null;

  return (
    <section className="mt-8 rounded-lg border border-foreground/10 bg-background p-5">
      <h2 className="text-lg font-semibold text-foreground">Waiting for approval</h2>
      <p className="mt-1 text-sm text-muted">
        These organizations have Wait for approval turned on. Approve to send through Paystack.
      </p>
      {error ? (
        <p className="mt-3 rounded-md border border-[var(--danger-line)] bg-[var(--danger-wash)] px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 rounded-md border border-[var(--success-line)] bg-[var(--success-wash)] px-3 py-2 text-sm text-[var(--success)]">
          {message}
        </p>
      ) : null}
      <div className="mt-4 space-y-2">
        {rows.map((row) => (
          <div
            key={row.batchId}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-foreground/10 px-3 py-3"
          >
            <div className="min-w-0">
              <p className="font-semibold text-foreground">
                {row.tenantName} · {row.periodLabel}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {row.staffCount} {row.staffCount === 1 ? "person" : "people"} · {row.currency}{" "}
                {row.amountLabel} · queued {row.createdAtLabel}
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                setMessage(null);
                startTransition(async () => {
                  const res = await platformApprovePayrollBatch({ batchId: row.batchId });
                  if (!res.ok) {
                    setError(res.error);
                    return;
                  }
                  setMessage(res.message);
                  router.refresh();
                });
              }}
              className="rounded-md border border-foreground bg-foreground px-3 py-2 text-xs font-semibold text-background disabled:opacity-50"
            >
              Approve &amp; send
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
