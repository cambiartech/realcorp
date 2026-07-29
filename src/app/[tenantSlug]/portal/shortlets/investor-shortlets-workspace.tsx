"use client";

import Link from "next/link";
import type { InvestorShortletPortfolio } from "@/lib/portal";

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(
      value,
    );
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

export function InvestorShortletsWorkspace({
  tenantSlug,
  tenantName,
  portfolio,
}: {
  tenantSlug: string;
  tenantName: string;
  portfolio: InvestorShortletPortfolio;
}) {
  const { units, totals } = portfolio;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Short lets</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">My shortlets</h1>
        <p className="mt-2 text-sm text-muted">
          Short-let apartments linked to your client profile at {tenantName}.
        </p>
        <Link
          href={`/${tenantSlug}/portal`}
          className="mt-3 inline-block text-sm text-muted underline decoration-foreground/30 hover:text-foreground"
        >
          ← Back to portfolio
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Linked apartments" value={String(totals.units)} />
        <StatCard label="Total collected" value={formatMoney(totals.collected, totals.currency)} />
        <StatCard label="Your earnings" value={formatMoney(totals.earnings, totals.currency)} highlight />
      </div>

      {units.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-foreground/15 px-6 py-14 text-center">
          <p className="text-sm font-medium text-foreground">No short-let apartments linked yet</p>
          <p className="mt-1 text-sm text-muted">
            When an admin links a short-let apartment to your client profile, it appears here with reservation
            earnings.
          </p>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-xl border border-foreground/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-foreground/[0.04] text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Apartment</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3 text-right">Stays</th>
                <th className="px-4 py-3 text-right">Collected</th>
                <th className="px-4 py-3 text-right">Your share</th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.unitId} className="border-t border-foreground/10">
                  <td className="px-4 py-3 font-medium">{unit.unitName}</td>
                  <td className="px-4 py-3 text-muted">{unit.projectName}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{unit.reservationCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatMoney(unit.totalCollected, unit.currency)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-[var(--success)]">
                    {formatMoney(unit.yourEarnings, unit.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={[
        "rounded-xl border px-4 py-3",
        highlight
          ? "border-[var(--success-line)] bg-[var(--success)]/[0.06]"
          : "border-foreground/10 bg-foreground/[0.02]",
      ].join(" ")}
    >
      <p className="text-xs text-muted">{label}</p>
      <p
        className={[
          "mt-1 text-xl font-semibold",
          highlight ? "text-[var(--success)]" : "text-foreground",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}
