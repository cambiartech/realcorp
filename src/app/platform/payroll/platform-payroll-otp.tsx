"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  platformConfirmPaystackBatchOtp,
  platformRejectPayrollBatch,
  platformResendPaystackTransferOtp,
} from "@/app/platform/actions";

export type PlatformPaystackOtpRow = {
  lineId: string;
  batchId: string;
  tenantName: string;
  periodLabel: string;
  staffName: string;
  amountLabel: string;
  currency: string;
  transferCode: string;
  accountNumber: string;
};

export function PlatformPayrollOtp({ rows }: { rows: PlatformPaystackOtpRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [otpByBatch, setOtpByBatch] = useState<Record<string, string>>({});
  const [noteByBatch, setNoteByBatch] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const batches = useMemo(() => {
    const grouped = new Map<string, PlatformPaystackOtpRow[]>();
    for (const row of rows) {
      const list = grouped.get(row.batchId) ?? [];
      list.push(row);
      grouped.set(row.batchId, list);
    }
    return [...grouped.entries()];
  }, [rows]);

  if (batches.length === 0) return null;

  return (
    <section className="mt-8 rounded-lg border border-foreground/10 bg-background p-5">
      <h2 className="text-lg font-semibold text-foreground">Paystack verification code</h2>
      <p className="mt-1 text-sm text-muted">
        These pays were opened as one transfer per person, so one code cannot cover the payroll.
        Reject them. Do not generate the month again. The next pay is one batch.
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
      <div className="mt-4 space-y-3">
        {batches.map(([batchId, people]) => {
          const first = people[0];
          return (
            <div key={batchId} className="rounded-lg border border-foreground/10 px-3 py-3">
              <p className="font-semibold text-foreground">
                {first.tenantName} · {first.periodLabel}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {people.length} still waiting · {first.currency}{" "}
                {people.map((person) => person.staffName).join(", ")}
              </p>
              {people.length === 1 ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otpByBatch[batchId] || ""}
                    onChange={(e) =>
                      setOtpByBatch((current) => ({
                        ...current,
                        [batchId]: e.target.value.replace(/\D/g, "").slice(0, 8),
                      }))
                    }
                    placeholder="SMS code"
                    className="w-36 rounded-md border border-foreground/15 bg-background px-3 py-2 font-mono text-sm"
                  />
                  <button
                    type="button"
                    disabled={pending || (otpByBatch[batchId] || "").length < 4}
                    onClick={() => {
                      setError(null);
                      setMessage(null);
                      startTransition(async () => {
                        const res = await platformConfirmPaystackBatchOtp({
                          batchId,
                          otp: otpByBatch[batchId] || "",
                        });
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
                    Confirm code
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setError(null);
                      setMessage(null);
                      startTransition(async () => {
                        const res = await platformResendPaystackTransferOtp({ lineId: first.lineId });
                        if (!res.ok) {
                          setError(res.error);
                          return;
                        }
                        setMessage("Paystack sent a new code for this one salary.");
                      });
                    }}
                    className="rounded-md border border-foreground/20 px-3 py-2 text-xs font-semibold disabled:opacity-50"
                  >
                    Resend code
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted">
                  One code cannot cover these people. Reject the payroll and pay again from the same month.
                </p>
              )}
              <textarea
                value={noteByBatch[batchId] || ""}
                onChange={(event) =>
                  setNoteByBatch((current) => ({ ...current, [batchId]: event.target.value }))
                }
                rows={2}
                placeholder="What does not match? Type this, then reject."
                className="mt-3 w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  const note = (noteByBatch[batchId] || "").trim();
                  if (note.length < 4) {
                    setError("Type a short note for HR, then reject. You do not generate a new month.");
                    setMessage(null);
                    return;
                  }
                  setError(null);
                  setMessage(null);
                  startTransition(async () => {
                    const res = await platformRejectPayrollBatch({ batchId, note });
                    if (!res.ok) {
                      setError(res.error);
                      return;
                    }
                    setMessage(res.message);
                    router.refresh();
                  });
                }}
                className="mt-2 rounded-md border border-[var(--danger-line)] px-3 py-2 text-xs font-semibold text-[var(--danger)] disabled:opacity-50"
              >
                Reject payroll
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
