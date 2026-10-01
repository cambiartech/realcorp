"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { platformApprovePayrollBatch, platformRejectPayrollBatch } from "@/app/platform/actions";

export type PlatformPayrollApprovalRow = {
  batchId: string;
  tenantName: string;
  tenantSlug: string;
  periodLabel: string;
  staffCount: number;
  amountLabel: string;
  platformFeeLabel: string;
  providerFeeLabel: string;
  currency: string;
  createdAtLabel: string;
  lines: Array<{
    id: string;
    name: string;
    netLabel: string;
    platformFeeLabel: string;
    providerFeeLabel: string;
  }>;
};

export function PlatformPayrollApprovals({ rows }: { rows: PlatformPayrollApprovalRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [noteByBatch, setNoteByBatch] = useState<Record<string, string>>({});

  if (rows.length === 0) return null;

  return (
    <section className="mt-8 rounded-lg border border-foreground/10 bg-background p-5">
      <h2 className="text-lg font-semibold text-foreground">Waiting for approval</h2>
      <p className="mt-1 text-sm text-muted">
        These organizations have Wait for approval turned on. Approve to send through Paystack, or reject with a note if something does not match. HR gets the note and can send again.
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
                {row.staffCount} {row.staffCount === 1 ? "person" : "people"} · salaries {row.currency}{" "}
                {row.amountLabel} · Realcorp fee {row.currency} {row.platformFeeLabel} · Paystack fee{" "}
                {row.currency} {row.providerFeeLabel} · queued {row.createdAtLabel}
              </p>
              <ul className="mt-2 space-y-1">
                {row.lines.map((line) => (
                  <li key={line.id} className="text-xs text-muted">
                    <span className="font-medium text-foreground">{line.name}</span>
                    {" · "}salary {row.currency} {line.netLabel}
                    {" · "}Realcorp {row.currency} {line.platformFeeLabel}
                    {" · "}Paystack {row.currency} {line.providerFeeLabel}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[280px]">
              <textarea
                value={noteByBatch[row.batchId] || ""}
                onChange={(event) =>
                  setNoteByBatch((current) => ({ ...current, [row.batchId]: event.target.value }))
                }
                rows={2}
                placeholder="What does not match? Type this, then reject."
                className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
              />
              <div className="flex flex-wrap gap-2">
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
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    const note = (noteByBatch[row.batchId] || "").trim();
                    if (note.length < 4) {
                      setError("Type a short note for HR, then reject.");
                      setMessage(null);
                      return;
                    }
                    setError(null);
                    setMessage(null);
                    startTransition(async () => {
                      const res = await platformRejectPayrollBatch({
                        batchId: row.batchId,
                        note,
                      });
                      if (!res.ok) {
                        setError(res.error);
                        return;
                      }
                      setMessage(res.message);
                      router.refresh();
                    });
                  }}
                  className="rounded-md border border-[var(--danger-line)] px-3 py-2 text-xs font-semibold text-[var(--danger)] disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
