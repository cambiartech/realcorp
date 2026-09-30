"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  platformConfirmPaystackTransferOtp,
  platformResendPaystackTransferOtp,
} from "@/app/platform/actions";

export type PlatformPaystackOtpRow = {
  lineId: string;
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
  const [otpByLine, setOtpByLine] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (rows.length === 0) return null;

  return (
    <section className="mt-8 rounded-lg border border-foreground/10 bg-background p-5">
      <h2 className="text-lg font-semibold text-foreground">Paystack verification code</h2>
      <p className="mt-1 text-sm text-muted">
        Paystack texts this code to the business phone on the Paystack account, not to the
        organization. Enter it here to release the salary. Codes expire in 30 minutes.
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
        {rows.map((row) => (
          <div key={row.lineId} className="rounded-lg border border-foreground/10 px-3 py-3">
            <p className="font-semibold text-foreground">
              {row.tenantName} · {row.staffName}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {row.periodLabel} · {row.currency} {row.amountLabel} · {row.accountNumber}
            </p>
            <p className="mt-1 font-mono text-[10px] text-muted">{row.transferCode}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otpByLine[row.lineId] || ""}
                onChange={(e) =>
                  setOtpByLine((current) => ({
                    ...current,
                    [row.lineId]: e.target.value.replace(/\D/g, "").slice(0, 8),
                  }))
                }
                placeholder="SMS code"
                className="w-36 rounded-md border border-foreground/15 bg-background px-3 py-2 font-mono text-sm"
              />
              <button
                type="button"
                disabled={pending || (otpByLine[row.lineId] || "").length < 4}
                onClick={() => {
                  setError(null);
                  setMessage(null);
                  startTransition(async () => {
                    const res = await platformConfirmPaystackTransferOtp({
                      lineId: row.lineId,
                      otp: otpByLine[row.lineId] || "",
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
                    const res = await platformResendPaystackTransferOtp({ lineId: row.lineId });
                    if (!res.ok) {
                      setError(res.error);
                      return;
                    }
                    setMessage(res.message);
                  });
                }}
                className="rounded-md border border-foreground/20 px-3 py-2 text-xs font-semibold disabled:opacity-50"
              >
                Resend code
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
