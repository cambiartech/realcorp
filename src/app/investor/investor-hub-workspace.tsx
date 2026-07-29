"use client";

import Link from "next/link";
import { ArrowUpRight, Building2 } from "lucide-react";
import type { InvestorOrgSummary } from "@/lib/portal";
import { RealcorpHeroLogo } from "@/components/realcorp-brand";

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(
      value,
    );
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

export function InvestorHubWorkspace({
  userName,
  organizations,
}: {
  userName: string | null;
  organizations: InvestorOrgSummary[];
}) {
  const totalEarnings = organizations.reduce((s, o) => s + o.earnings, 0);
  const totalProjects = organizations.reduce((s, o) => s + o.projectCount, 0);
  const primaryCurrency = organizations[0]?.currency ?? "NGN";

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-foreground/10 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <RealcorpHeroLogo />
          <div className="flex items-center gap-3 text-sm">
            {userName ? <span className="hidden text-muted sm:inline">{userName}</span> : null}
            <Link href="/login" className="text-muted hover:text-foreground">
              Sign out
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Your investments</h1>
        <p className="mt-1 text-sm text-muted">
          All organizations where you hold an investor or listing-owner stake — across Realcorp tenants.
        </p>

        {organizations.length > 0 ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] px-4 py-3">
              <p className="text-xs text-muted">Organizations</p>
              <p className="mt-1 text-xl font-semibold">{organizations.length}</p>
            </div>
            <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] px-4 py-3">
              <p className="text-xs text-muted">Projects</p>
              <p className="mt-1 text-xl font-semibold">{totalProjects}</p>
            </div>
            <div className="rounded-xl border border-[var(--success-line)] bg-[var(--success)]/[0.06] px-4 py-3">
              <p className="text-xs text-muted">Total earnings</p>
              <p className="mt-1 text-xl font-semibold text-[var(--success)]">
                {formatMoney(totalEarnings, primaryCurrency)}
              </p>
            </div>
          </div>
        ) : null}

        {organizations.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-foreground/15 px-6 py-14 text-center">
            <p className="text-sm font-medium">No investor accounts found</p>
            <p className="mt-1 text-sm text-muted">
              When a developer invites you as an investor, your organizations will appear here.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {organizations.map((org) => (
              <Link
                key={org.tenantSlug}
                href={`/${org.tenantSlug}/portal`}
                className="group flex items-center gap-4 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 shadow-sm transition-all hover:border-foreground/20 hover:shadow-md"
              >
                {org.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={org.logoUrl} alt="" className="h-12 w-12 rounded-lg object-contain" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground/[0.06]">
                    <Building2 className="h-6 w-6 text-muted" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground group-hover:underline">{org.tenantName}</p>
                  <p className="text-xs text-muted">
                    {org.projectCount} project{org.projectCount === 1 ? "" : "s"} ·{" "}
                    {org.allocated > 0 ? `${formatMoney(org.allocated, org.currency)} allocated · ` : ""}
                    {formatMoney(org.earnings, org.currency)} earnings
                  </p>
                </div>
                <ArrowUpRight className="h-5 w-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
