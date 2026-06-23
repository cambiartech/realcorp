"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, BedDouble, CheckCircle2, Compass, LayoutGrid, Search, Sparkles } from "lucide-react";
import type {
  InvestorOrgSummary,
  InvestorShortletPortfolio,
  PublicListing,
  StakeholderPortfolio,
  PortfolioProject,
  InvestorShortletUnit,
} from "@/lib/portal";
import { submitInvestorInterest } from "./actions";

export type InvestorContact = {
  name: string;
  email: string;
  phone: string | null;
};

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

function formatPrice(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

const STAKE_LABEL: Record<PortfolioProject["stakeType"], string> = {
  INVESTOR: "Investor",
  LISTING_OWNER: "Listing owner",
};

type Tab = "projects" | "shortlets" | "discover";

export function PortalWorkspace({
  tenantSlug,
  tenantName,
  userName,
  investorContact,
  portfolio,
  shortletPortfolio,
  showShortlets,
  discoverListings,
  allOrganizations,
  accentColor,
  isAdminViewer,
}: {
  tenantSlug: string;
  tenantName: string;
  userName: string | null;
  investorContact: InvestorContact;
  portfolio: StakeholderPortfolio;
  shortletPortfolio: InvestorShortletPortfolio;
  showShortlets: boolean;
  discoverListings: PublicListing[];
  allOrganizations: InvestorOrgSummary[];
  accentColor: string | null;
  isAdminViewer: boolean;
}) {
  const { projects, totals, recentPayments } = portfolio;
  const { units: shortlets, totals: shortletTotals } = shortletPortfolio;
  const [tab, setTab] = useState<Tab>("projects");
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [paymentQuery, setPaymentQuery] = useState("");
  const [interestListing, setInterestListing] = useState<PublicListing | null>(null);

  const otherOrgs = allOrganizations.filter((o) => o.tenantSlug !== tenantSlug);
  const accent = accentColor || "#0a0a0a";

  const filteredDiscover = useMemo(() => {
    const q = discoverQuery.trim().toLowerCase();
    if (!q) return discoverListings;
    return discoverListings.filter((l) => {
      const hay = [l.name, l.description, l.city, l.state].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [discoverListings, discoverQuery]);

  const filteredPayments = useMemo(() => {
    const q = paymentQuery.trim().toLowerCase();
    if (!q) return recentPayments;
    return recentPayments.filter((p) =>
      [p.label, p.projectName, formatDate(p.paidAt)].join(" ").toLowerCase().includes(q),
    );
  }, [recentPayments, paymentQuery]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-foreground/10 bg-gradient-to-br from-foreground/[0.04] via-background to-emerald-500/[0.06] px-6 py-8 sm:px-8">
        <div className="relative z-10 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Investor dashboard</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {userName ? `Welcome back, ${userName.split(" ")[0]}` : "My portfolio"}
          </h1>
          <p className="mt-2 text-sm text-muted sm:text-base">
            Track your investments with {tenantName}, discover new opportunities, and see earnings from your allocations.
          </p>
        </div>
        <Sparkles className="pointer-events-none absolute -right-2 -top-2 h-32 w-32 text-foreground/[0.04]" />
      </div>

      {isAdminViewer ? (
        <div className="mt-4 rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3 text-sm text-muted">
          Admin preview — link properties from <strong className="text-foreground">Clients</strong> or add
          investors from <strong className="text-foreground">Stakeholders</strong> so they see their portfolio here.
        </div>
      ) : null}

      {/* Cross-tenant banner */}
      {(otherOrgs.length > 0 || allOrganizations.length > 1) ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-500/20 bg-violet-500/[0.06] px-4 py-3">
          <div className="text-sm text-foreground">
            {allOrganizations.length > 1 ? (
              <>
                You have investments across <strong>{allOrganizations.length} organizations</strong>
                {otherOrgs.length > 0 ? ` including ${otherOrgs.map((o) => o.tenantName).join(", ")}` : ""}.
              </>
            ) : null}
          </div>
          <Link
            href="/investor"
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90"
          >
            View all investments
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : null}

      {/* Stats */}
      <div className={`mt-6 grid gap-3 sm:grid-cols-2 ${showShortlets ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        <StatCard label="Your projects" value={String(totals.projects)} />
        {showShortlets ? (
          <StatCard label="Your shortlets" value={String(shortletTotals.units)} />
        ) : null}
        <StatCard label="Total allocated" value={totals.allocated > 0 ? formatMoney(totals.allocated, totals.currency) : "—"} />
        <StatCard
          label="Total collected"
          value={formatMoney(totals.collected + shortletTotals.collected, totals.currency)}
        />
        <StatCard
          label="Your earnings"
          value={formatMoney(totals.earnings + shortletTotals.earnings, totals.currency)}
          highlight
        />
      </div>

      {/* Tabs */}
      <div className="mt-8 flex flex-wrap items-center gap-2 border-b border-foreground/10 pb-3">
        <TabButton active={tab === "projects"} onClick={() => setTab("projects")} icon={LayoutGrid}>
          Projects
          <TabCountBadge count={projects.length} active={tab === "projects"} variant="default" />
        </TabButton>
        {showShortlets ? (
          <TabButton active={tab === "shortlets"} onClick={() => setTab("shortlets")} icon={BedDouble}>
            Shortlets
            <TabCountBadge count={shortlets.length} active={tab === "shortlets"} variant="amber" />
          </TabButton>
        ) : null}
        <TabButton active={tab === "discover"} onClick={() => setTab("discover")} icon={Compass}>
          Discover opportunities
          <TabCountBadge count={discoverListings.length} active={tab === "discover"} variant="emerald" />
        </TabButton>
      </div>

      {tab === "projects" ? (
        <>
          {projects.length === 0 ? (
            <div className="mt-8 rounded-xl border border-dashed border-foreground/15 px-6 py-14 text-center">
              <p className="text-sm font-medium text-foreground">No projects linked yet</p>
              <p className="mt-1 text-sm text-muted">
                Once {tenantName} links a development unit to your profile, it appears here.
              </p>
              {discoverListings.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setTab("discover")}
                  className="mt-4 text-sm font-medium text-foreground underline underline-offset-2"
                >
                  Browse {discoverListings.length} available opportunities →
                </button>
              ) : null}
            </div>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {projects.map((project) => (
                <ProjectCard key={project.projectId} tenantSlug={tenantSlug} project={project} />
              ))}
            </div>
          )}

          {recentPayments.length > 0 ? (
            <div className="mt-10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Recent payments</h2>
                <div className="relative w-full max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                  <input
                    value={paymentQuery}
                    onChange={(e) => setPaymentQuery(e.target.value)}
                    placeholder="Filter payments…"
                    className="w-full rounded-lg border border-foreground/15 bg-field py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
              </div>
              <div className="mt-3 overflow-hidden rounded-xl border border-foreground/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-foreground/[0.04] text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Detail</th>
                      <th className="px-4 py-2.5">Project</th>
                      <th className="px-4 py-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-foreground/[0.06]">
                    {filteredPayments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-foreground/[0.02]">
                        <td className="px-4 py-2.5 whitespace-nowrap text-muted">{formatDate(payment.paidAt)}</td>
                        <td className="px-4 py-2.5 text-foreground">{payment.label}</td>
                        <td className="px-4 py-2.5 text-muted">{payment.projectName}</td>
                        <td className="px-4 py-2.5 text-right font-medium">{formatMoney(payment.amount, payment.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      ) : tab === "shortlets" && showShortlets ? (
        <>
          {shortlets.length === 0 ? (
            <div className="mt-8 rounded-xl border border-dashed border-foreground/15 px-6 py-14 text-center">
              <p className="text-sm font-medium text-foreground">No short-let apartments linked yet</p>
              <p className="mt-1 text-sm text-muted">
                When {tenantName} links a short-let apartment to your client profile, it appears here with stay and
                earnings data.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <StatCard label="Linked apartments" value={String(shortletTotals.units)} />
                <StatCard label="Total collected" value={formatMoney(shortletTotals.collected, shortletTotals.currency)} />
                <StatCard
                  label="Your earnings"
                  value={formatMoney(shortletTotals.earnings, shortletTotals.currency)}
                  highlight
                />
              </div>
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {shortlets.map((unit) => (
                  <ShortletCard key={unit.unitId} tenantSlug={tenantSlug} unit={unit} />
                ))}
              </div>
              <p className="mt-4 text-center text-xs text-muted">
                <Link href={`/${tenantSlug}/portal/shortlets`} className="font-medium underline underline-offset-2">
                  Open detailed shortlet report →
                </Link>
              </p>
            </>
          )}
        </>
      ) : (
        <div className="mt-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={discoverQuery}
                onChange={(e) => setDiscoverQuery(e.target.value)}
                placeholder="Search projects by name or location…"
                className="w-full rounded-lg border border-foreground/15 bg-field py-2 pl-9 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </div>
          </div>

          {filteredDiscover.length === 0 ? (
            <div className="rounded-xl border border-dashed border-foreground/15 px-6 py-14 text-center">
              <p className="text-sm font-medium text-foreground">
                {discoverListings.length === 0 ? "No new opportunities right now" : "No listings match your search"}
              </p>
              <p className="mt-1 text-sm text-muted">
                {discoverListings.length === 0
                  ? "Check back when new projects are published, or contact your relationship manager."
                  : "Try a different search term."}
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDiscover.map((listing) => (
                <DiscoverCard
                  key={listing.id}
                  listing={listing}
                  accent={accent}
                  onExpressInterest={() => setInterestListing(listing)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {interestListing ? (
        <InvestorInterestModal
          tenantSlug={tenantSlug}
          listing={interestListing}
          contact={investorContact}
          accent={accent}
          onClose={() => setInterestListing(null)}
        />
      ) : null}
    </div>
  );
}

function TabCountBadge({
  count,
  active,
  variant,
}: {
  count: number;
  active: boolean;
  variant: "default" | "amber" | "emerald";
}) {
  if (count <= 0) return null;

  if (active) {
    return (
      <span className="ml-1 min-w-[1.25rem] rounded-full bg-background px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-foreground">
        {count}
      </span>
    );
  }

  if (variant === "amber") {
    return (
      <span className="ml-1 min-w-[1.25rem] rounded-full bg-amber-500/20 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-amber-900 dark:text-amber-100">
        {count}
      </span>
    );
  }

  if (variant === "emerald") {
    return (
      <span className="ml-1 min-w-[1.25rem] rounded-full bg-emerald-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white">
        {count}
      </span>
    );
  }

  return (
    <span className="ml-1 min-w-[1.25rem] rounded-full bg-foreground/10 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-foreground">
      {count}
    </span>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof LayoutGrid;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-foreground text-background" : "text-muted hover:bg-foreground/[0.06] hover:text-foreground",
      ].join(" ")}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3.5 ${
        highlight ? "border-emerald-500/25 bg-emerald-500/[0.06]" : "border-foreground/10 bg-foreground/[0.02]"
      }`}
    >
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${highlight ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function DiscoverCard({
  listing,
  accent,
  onExpressInterest,
}: {
  listing: PublicListing;
  accent: string;
  onExpressInterest: () => void;
}) {
  const location = [listing.city, listing.state].filter(Boolean).join(", ");
  const price =
    listing.priceFrom != null
      ? listing.priceTo != null && listing.priceTo !== listing.priceFrom
        ? `${formatPrice(listing.priceFrom, listing.currency)} – ${formatPrice(listing.priceTo, listing.currency)}`
        : `From ${formatPrice(listing.priceFrom, listing.currency)}`
      : "Price on request";

  return (
    <article className="group overflow-hidden rounded-xl border border-foreground/10 bg-foreground/[0.02] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative h-44 overflow-hidden bg-foreground/[0.05]">
        {listing.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.coverImageUrl}
            alt={listing.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl font-bold text-white" style={{ backgroundColor: accent }}>
            {listing.name.charAt(0)}
          </div>
        )}
        {listing.unitsAvailable > 0 ? (
          <span className="absolute left-3 top-3 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow">
            {listing.unitsAvailable} units available
          </span>
        ) : null}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-foreground">{listing.name}</h3>
        {location ? <p className="mt-0.5 text-xs text-muted">{location}</p> : null}
        <p className="mt-2 text-sm font-medium text-foreground">{price}</p>
        {listing.description ? (
          <p className="mt-2 line-clamp-2 text-xs text-muted">{listing.description}</p>
        ) : null}
        <button
          type="button"
          onClick={onExpressInterest}
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-foreground bg-foreground py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          Express interest
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function ProjectCard({ tenantSlug, project }: { tenantSlug: string; project: PortfolioProject }) {
  const soldPct = project.unitsTotal > 0 ? Math.round((project.unitsSold / project.unitsTotal) * 100) : 0;
  const location = [project.city, project.state].filter(Boolean).join(", ");
  const href = `/${tenantSlug}/portal/projects/${project.projectId}`;

  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-xl border border-foreground/10 shadow-sm transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md"
    >
      {project.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={project.coverImageUrl}
          alt={project.projectName}
          className="h-40 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      ) : (
        <div className="flex h-40 items-center justify-center bg-foreground/[0.05] text-2xl font-bold text-muted">
          {project.projectName.charAt(0)}
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-foreground group-hover:underline">{project.projectName}</h3>
            <p className="mt-0.5 text-xs text-muted">
              {STAKE_LABEL[project.stakeType]}
              {project.allocationAmount > 0 ? ` · ${formatMoney(project.allocationAmount, project.currency)} allocated` : ""}
              {location ? ` · ${location}` : ""}
            </p>
            {project.linkedUnitLabels && project.linkedUnitLabels.length > 0 ? (
              <p className="mt-1 text-xs font-medium text-foreground">
                Your unit{project.linkedUnitLabels.length > 1 ? "s" : ""}:{" "}
                {project.linkedUnitLabels.join(", ")}
              </p>
            ) : null}
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              project.isPublished ? "bg-emerald-500/10 text-emerald-600" : "bg-foreground/[0.06] text-muted"
            }`}
          >
            {project.isPublished ? "Live" : "Private"}
          </span>
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted">
            <span>
              {project.unitsSold}/{project.unitsTotal} sold
              {project.unitsReserved > 0 ? ` · ${project.unitsReserved} reserved` : ""}
            </span>
            <span>{soldPct}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
            <div className="h-full rounded-full bg-emerald-600" style={{ width: `${soldPct}%` }} />
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Metric label="Invoiced" value={formatMoney(project.totalInvoiced, project.currency)} />
          <Metric label="Collected" value={formatMoney(project.totalCollected, project.currency)} />
          <Metric label="Earnings" value={formatMoney(project.yourEarnings, project.currency)} highlight />
        </dl>
        <p className="mt-3 text-center text-xs font-medium text-muted group-hover:text-foreground">
          View project details →
        </p>
      </div>
    </Link>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg px-2 py-2 ${highlight ? "bg-emerald-500/[0.06]" : "bg-foreground/[0.03]"}`}>
      <dt className="text-[10px] text-muted">{label}</dt>
      <dd className={`mt-0.5 text-xs font-semibold ${highlight ? "text-emerald-600" : "text-foreground"}`}>{value}</dd>
    </div>
  );
}

function ShortletCard({ tenantSlug, unit }: { tenantSlug: string; unit: InvestorShortletUnit }) {
  const href = `/${tenantSlug}/portal/shortlets`;

  return (
    <Link
      href={href}
      className="group block overflow-hidden rounded-xl border border-amber-500/20 bg-amber-500/[0.03] shadow-sm transition-all hover:-translate-y-0.5 hover:border-amber-500/35 hover:shadow-md"
    >
      <div className="flex items-center gap-3 border-b border-amber-500/15 bg-amber-500/[0.06] px-4 py-3">
        <BedDouble className="h-5 w-5 text-amber-700 dark:text-amber-300" />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
            Short-let
          </p>
          <h3 className="truncate font-semibold text-foreground group-hover:underline">{unit.unitName}</h3>
        </div>
        <span className="ml-auto shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:text-amber-100">
          Active
        </span>
      </div>
      <div className="p-4">
        <p className="text-xs text-muted">{unit.projectName}</p>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Metric label="Stays" value={String(unit.reservationCount)} />
          <Metric label="Collected" value={formatMoney(unit.totalCollected, unit.currency)} />
          <Metric label="Earnings" value={formatMoney(unit.yourEarnings, unit.currency)} highlight />
        </dl>
        <p className="mt-3 text-center text-xs font-medium text-muted group-hover:text-foreground">
          View shortlet details →
        </p>
      </div>
    </Link>
  );
}

function InvestorInterestModal({
  tenantSlug,
  listing,
  contact,
  accent,
  onClose,
}: {
  tenantSlug: string;
  listing: PublicListing;
  contact: InvestorContact;
  accent: string;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    submitInvestorInterest.bind(null, tenantSlug),
    null as { ok: true } | { ok: false; error: string } | null,
  );
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const needsPhone = !contact.phone;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submitted = state?.ok === true;
  const location = [listing.city, listing.state].filter(Boolean).join(", ");
  const price =
    listing.priceFrom != null
      ? listing.priceTo != null && listing.priceTo !== listing.priceFrom
        ? `${formatPrice(listing.priceFrom, listing.currency)} – ${formatPrice(listing.priceTo, listing.currency)}`
        : `From ${formatPrice(listing.priceFrom, listing.currency)}`
      : "Price on request";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Express interest in ${listing.name}`}
        className="w-full max-w-md rounded-xl border border-foreground/10 bg-background p-5 shadow-2xl"
      >
        {submitted ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <h3 className="mt-3 text-lg font-semibold">Interest recorded</h3>
            <p className="mt-1 text-sm text-muted">
              Our team will follow up about <strong className="text-foreground">{listing.name}</strong> at{" "}
              <strong className="text-foreground">{contact.email || contact.name}</strong>.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: accent }}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Express interest</p>
                <h3 className="mt-0.5 text-base font-semibold">{listing.name}</h3>
                {location ? <p className="text-xs text-muted">{location}</p> : null}
                <p className="mt-1 text-xs font-medium text-foreground">{price}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-md p-1 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-foreground">Using your investor profile</p>
                  <p className="mt-1 text-muted">
                    <span className="font-medium text-foreground">{contact.name}</span>
                    {contact.email ? (
                      <>
                        {" "}
                        · <span className="text-foreground">{contact.email}</span>
                      </>
                    ) : null}
                    {contact.phone && !needsPhone ? (
                      <>
                        {" "}
                        · <span className="text-foreground">{contact.phone}</span>
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
            </div>

            <form action={formAction} className="mt-4 space-y-3">
              <input type="hidden" name="projectId" value={listing.id} />

              {needsPhone ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">
                    Phone (WhatsApp) — we need this once to reach you
                  </label>
                  <input
                    name="phone"
                    required
                    inputMode="tel"
                    placeholder="0803 123 4567"
                    className="w-full rounded-lg border border-foreground/15 bg-field px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
              ) : (
                <input type="hidden" name="phone" value={contact.phone ?? ""} />
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Note (optional)</label>
                <textarea
                  name="message"
                  rows={2}
                  placeholder={`I'm interested in ${listing.name}…`}
                  className="w-full rounded-lg border border-foreground/15 bg-field px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>

              {state && !state.ok ? (
                <p className="text-sm font-medium text-error">{state.error}</p>
              ) : null}

              <button
                type="submit"
                disabled={pending}
                aria-busy={pending}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: accent }}
              >
                {pending ? "Sending…" : "Confirm interest"}
              </button>
            </form>

          
          </>
        )}
      </div>
    </div>
  );
}
