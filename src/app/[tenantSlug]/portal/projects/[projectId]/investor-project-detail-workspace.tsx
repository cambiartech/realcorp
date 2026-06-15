"use client";

import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import type { InvestorProjectDetail } from "@/lib/portal";

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const STAKE_LABEL: Record<InvestorProjectDetail["stakeType"], string> = {
  INVESTOR: "Investor",
  LISTING_OWNER: "Listing owner",
};

export function InvestorProjectDetailWorkspace({
  tenantSlug,
  tenantName,
  project,
}: {
  tenantSlug: string;
  tenantName: string;
  project: InvestorProjectDetail;
}) {
  const soldPct = project.unitsTotal > 0 ? Math.round((project.unitsSold / project.unitsTotal) * 100) : 0;
  const locationLine = [project.city, project.state].filter(Boolean).join(", ");
  const allocationShare =
    project.totalProjectAllocation > 0 && project.allocationAmount > 0
      ? Math.round((project.allocationAmount / project.totalProjectAllocation) * 100)
      : 0;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <Link
        href={`/${tenantSlug}/portal`}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to portfolio
      </Link>

      {/* Hero */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-foreground/10">
        {project.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.coverImageUrl} alt="" className="h-52 w-full object-cover sm:h-64" />
        ) : (
          <div className="flex h-52 items-center justify-center bg-foreground/[0.06] text-5xl font-bold text-muted sm:h-64">
            {project.projectName.charAt(0)}
          </div>
        )}
        <div className="border-t border-foreground/10 bg-background p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{tenantName}</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">{project.projectName}</h1>
              {locationLine || project.locationAddress ? (
                <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {[project.locationAddress, locationLine].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-foreground/[0.06] px-2.5 py-1 text-xs font-medium text-foreground">
                {STAKE_LABEL[project.stakeType]}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  project.isPublished ? "bg-emerald-500/10 text-emerald-600" : "bg-foreground/[0.06] text-muted"
                }`}
              >
                {project.isPublished ? "Live listing" : "Private"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Your stake */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Your allocation" value={project.allocationAmount > 0 ? formatMoney(project.allocationAmount, project.currency) : "—"} />
        <Stat
          label="Share of pool"
          value={allocationShare > 0 ? `${allocationShare}%` : "—"}
          hint={
            project.totalProjectAllocation > project.allocationAmount
              ? `of ${formatMoney(project.totalProjectAllocation, project.currency)} total`
              : undefined
          }
        />
        <Stat label="Your earnings" value={formatMoney(project.yourEarnings, project.currency)} highlight />
        <Stat label="Outstanding" value={formatMoney(project.outstanding, project.currency)} />
      </div>

      {/* Sales progress */}
      <section className="mt-8 rounded-xl border border-foreground/10 p-5">
        <h2 className="text-sm font-semibold text-foreground">Sales progress</h2>
        <div className="mt-3 flex justify-between text-sm text-muted">
          <span>
            {project.unitsSold} sold · {project.unitsReserved} reserved · {project.unitsAvailable} available
          </span>
          <span className="font-medium text-foreground">{soldPct}% sold</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-foreground/[0.08]">
          <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${soldPct}%` }} />
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-3">
          <MetricBox label="Invoiced" value={formatMoney(project.totalInvoiced, project.currency)} />
          <MetricBox label="Collected" value={formatMoney(project.totalCollected, project.currency)} />
          <MetricBox label="Your earnings" value={formatMoney(project.yourEarnings, project.currency)} highlight />
        </dl>
      </section>

      {/* About */}
      {project.description || project.amenities.length > 0 ? (
        <section className="mt-6 rounded-xl border border-foreground/10 p-5">
          <h2 className="text-sm font-semibold text-foreground">About this project</h2>
          {project.description ? <p className="mt-2 text-sm leading-relaxed text-muted">{project.description}</p> : null}
          {project.amenities.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {project.amenities.map((a) => (
                <span key={a} className="rounded-full border border-foreground/10 px-2.5 py-0.5 text-xs text-foreground">
                  {a}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Gallery */}
      {project.galleryUrls.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-foreground">Gallery</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {project.galleryUrls.map((url) => (
              <div key={url} className="aspect-[4/3] overflow-hidden rounded-lg border border-foreground/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Payments */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Payment history</h2>
        {project.payments.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-foreground/15 px-4 py-8 text-center text-sm text-muted">
            No payments recorded on this project yet. Earnings update when collections are logged.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-foreground/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-foreground/[0.04] text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Detail</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/[0.06]">
                {project.payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-foreground/[0.02]">
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted">{formatDate(payment.paidAt)}</td>
                    <td className="px-4 py-2.5 text-foreground">{payment.label}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{formatMoney(payment.amount, payment.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {project.isPublished ? (
        <div className="mt-8 text-center">
          <Link
            href={`/explore/${tenantSlug}`}
            className="text-sm font-medium text-foreground underline underline-offset-2"
          >
            View public listing page →
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3.5 ${
        highlight ? "border-emerald-500/25 bg-emerald-500/[0.06]" : "border-foreground/10 bg-foreground/[0.02]"
      }`}
    >
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${highlight ? "text-emerald-600" : "text-foreground"}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted">{hint}</p> : null}
    </div>
  );
}

function MetricBox({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2.5 text-center ${highlight ? "bg-emerald-500/[0.06]" : "bg-foreground/[0.03]"}`}>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className={`mt-0.5 text-sm font-semibold ${highlight ? "text-emerald-600" : "text-foreground"}`}>{value}</dd>
    </div>
  );
}
