"use client";

import type { PayslipYtdSummary } from "@/lib/hr-payslip-ytd";

export function PayslipYtdCard({
  ytd,
  currency,
  compact,
}: {
  ytd: PayslipYtdSummary | null;
  currency: string;
  compact?: boolean;
}) {
  if (!ytd || ytd.monthsPaid === 0) {
    return (
      <div
        className={
          compact
            ? "text-xs text-muted"
            : "rounded-lg border border-dashed border-foreground/15 p-4 text-sm text-muted"
        }
      >
        No finalized payslips for {new Date().getFullYear()} yet.
      </div>
    );
  }

  const money = (n: number) =>
    `${currency} ${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const rows = [
    { label: "Gross (YTD)", value: money(ytd.grossYtd) },
    { label: "Payee tax (YTD)", value: money(ytd.payeeYtd) },
    { label: "Pension (YTD)", value: money(ytd.pensionYtd) },
    { label: "Net pay (YTD)", value: money(ytd.netYtd), highlight: true },
  ];

  if (compact) {
    return (
      <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
        <p className="text-xs font-semibold text-foreground">
          {ytd.year} YTD · {ytd.monthsPaid} month{ytd.monthsPaid === 1 ? "" : "s"}
        </p>
        <p className="mt-1 text-sm font-bold text-foreground">{money(ytd.netYtd)} net</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Year-to-date ({ytd.year})</p>
        <span className="text-xs text-muted">
          {ytd.monthsPaid} finalized month{ytd.monthsPaid === 1 ? "" : "s"}
        </span>
      </div>
      <dl className="grid gap-2 sm:grid-cols-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className={[
              "rounded-md border border-foreground/10 px-3 py-2",
              r.highlight ? "border-[var(--success-line)] bg-[var(--success-wash)] sm:col-span-2" : "",
            ].join(" ")}
          >
            <dt className="text-[10px] font-medium uppercase tracking-wide text-muted">{r.label}</dt>
            <dd
              className={[
                "mt-0.5 tabular-nums",
                r.highlight ? "text-lg font-bold text-foreground" : "text-sm font-semibold",
              ].join(" ")}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
