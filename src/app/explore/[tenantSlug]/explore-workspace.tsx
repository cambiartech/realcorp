"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { PublicListing, PublicListingBrand } from "@/lib/public-listings";
import { submitExploreInquiry } from "./actions";

const PURPOSE_LABELS: Record<string, string> = {
  SALE: "For Sale",
  SHORT_LET: "Short Let",
  RENTAL: "Rental",
  HOSTEL: "Hostel",
};

function formatPrice(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function priceLabel(listing: PublicListing) {
  if (listing.priceFrom == null) return "Price on request";
  if (listing.priceTo != null && listing.priceTo !== listing.priceFrom) {
    return `${formatPrice(listing.priceFrom, listing.currency)} – ${formatPrice(listing.priceTo, listing.currency)}`;
  }
  return `From ${formatPrice(listing.priceFrom, listing.currency)}`;
}

export function ExploreWorkspace({
  tenantSlug,
  brand,
  listings,
  embed = false,
}: {
  tenantSlug: string;
  brand: PublicListingBrand;
  listings: PublicListing[];
  embed?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [purpose, setPurpose] = useState<string>("ALL");
  const [inquiryFor, setInquiryFor] = useState<PublicListing | null>(null);

  const cities = useMemo(
    () => Array.from(new Set(listings.map((l) => l.city).filter((c): c is string => Boolean(c)))).sort(),
    [listings],
  );
  const [city, setCity] = useState<string>("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listings.filter((l) => {
      if (purpose !== "ALL" && !l.purposes.includes(purpose)) return false;
      if (city !== "ALL" && l.city !== city) return false;
      if (q) {
        const hay = [l.name, l.description, l.city, l.state].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [listings, query, purpose, city]);

  const accent = brand.accentColor || "#0a0a0a";

  return (
    <div className={embed ? "px-3 py-4" : "mx-auto w-full max-w-6xl px-4 py-8 sm:px-6"}>
      {/* Branded header */}
      {!embed ? (
        <header className="mb-8 flex items-center gap-3">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt="" className="h-10 w-auto max-w-[140px] object-contain" />
          ) : null}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{brand.tenantName}</h1>
            <p className="text-sm text-muted">Explore our available projects and listings</p>
          </div>
        </header>
      ) : null}

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or location…"
          className="w-full rounded-lg border border-foreground/15 bg-field px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20 sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1.5">
          {["ALL", "SALE", "SHORT_LET", "RENTAL"].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPurpose(p)}
              className={[
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                purpose === p
                  ? "border-foreground bg-foreground text-background"
                  : "border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground",
              ].join(" ")}
            >
              {p === "ALL" ? "All" : PURPOSE_LABELS[p]}
            </button>
          ))}
        </div>
        {cities.length > 1 ? (
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="rounded-lg border border-foreground/15 bg-field px-3 py-2 text-sm focus:outline-none"
          >
            <option value="ALL">All locations</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-foreground/15 bg-foreground/[0.02] px-4 py-16 text-center">
          <p className="text-sm font-medium">No listings match your search</p>
          <p className="mt-1 text-sm text-muted">Try a different location or clear the filters.</p>
        </div>
      ) : (
        <div className={embed ? "grid gap-4 sm:grid-cols-2" : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3"}>
          {filtered.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              accent={accent}
              onInquire={() => setInquiryFor(listing)}
            />
          ))}
        </div>
      )}

      {!embed ? (
        <p className="mt-10 text-center text-xs text-muted">Powered by {brand.tenantName} · Realcorp</p>
      ) : null}

      {inquiryFor ? (
        <InquiryModal
          tenantSlug={tenantSlug}
          listing={inquiryFor}
          accent={accent}
          onClose={() => setInquiryFor(null)}
        />
      ) : null}
    </div>
  );
}

function ListingCard({
  listing,
  accent,
  onInquire,
}: {
  listing: PublicListing;
  accent: string;
  onInquire: () => void;
}) {
  const location = [listing.city, listing.state].filter(Boolean).join(", ");
  return (
    <article className="group overflow-hidden rounded-xl border border-foreground/10 bg-foreground/[0.02] shadow-sm transition-shadow hover:shadow-md">
      <div className="relative h-44 w-full overflow-hidden bg-foreground/[0.05]">
        {listing.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.coverImageUrl}
            alt={listing.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-3xl font-bold text-background"
            style={{ backgroundColor: accent }}
          >
            {listing.name.charAt(0).toUpperCase()}
          </div>
        )}
        {listing.unitsAvailable > 0 ? (
          <span className="absolute left-3 top-3 rounded-full bg-[var(--success)] px-2.5 py-1 text-[11px] font-semibold text-white shadow">
            {listing.unitsAvailable} available
          </span>
        ) : null}
      </div>
      <div className="p-4">
        <h2 className="text-base font-semibold leading-snug">{listing.name}</h2>
        {location ? <p className="mt-0.5 text-xs text-muted">{location}</p> : null}
        <p className="mt-2 text-sm font-bold" style={{ color: accent }}>
          {priceLabel(listing)}
        </p>
        {listing.description ? (
          <p className="mt-1.5 line-clamp-2 text-xs text-muted">{listing.description}</p>
        ) : null}
        {listing.amenities.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {listing.amenities.slice(0, 4).map((a) => (
              <span
                key={a}
                className="rounded-full border border-foreground/10 bg-foreground/[0.04] px-2 py-0.5 text-[10px] font-medium text-muted"
              >
                {a}
              </span>
            ))}
            {listing.amenities.length > 4 ? (
              <span className="px-1 py-0.5 text-[10px] text-muted">+{listing.amenities.length - 4}</span>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          onClick={onInquire}
          className="mt-4 w-full rounded-lg px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: accent }}
        >
          I&apos;m interested
        </button>
      </div>
    </article>
  );
}

function InquiryModal({
  tenantSlug,
  listing,
  accent,
  onClose,
}: {
  tenantSlug: string;
  listing: PublicListing;
  accent: string;
  onClose: () => void;
}) {
  const searchParams = useSearchParams();
  const [state, formAction, pending] = useActionState(
    submitExploreInquiry.bind(null, tenantSlug),
    null as { ok: true } | { ok: false; error: string } | null,
  );
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submitted = state?.ok === true;

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
        aria-label={`Inquire about ${listing.name}`}
        className="w-full max-w-md rounded-xl border border-foreground/10 bg-background p-5 shadow-2xl"
      >
        {submitted ? (
          <div className="py-6 text-center">
            <p className="text-3xl">🎉</p>
            <h3 className="mt-2 text-lg font-semibold">Thank you!</h3>
            <p className="mt-1 text-sm text-muted">
              Our team will reach out about <strong>{listing.name}</strong> shortly.
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
                <h3 className="text-base font-semibold">{listing.name}</h3>
                <p className="text-xs text-muted">{priceLabel(listing)}</p>
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
            <form action={formAction} className="mt-4 space-y-3">
              <input type="hidden" name="projectId" value={listing.id} />
              <input type="hidden" name="utmSource" value={searchParams.get("utm_source") ?? ""} />
              <input type="hidden" name="utmMedium" value={searchParams.get("utm_medium") ?? ""} />
              <input type="hidden" name="utmCampaign" value={searchParams.get("utm_campaign") ?? ""} />
              <input type="hidden" name="utmContent" value={searchParams.get("utm_content") ?? ""} />
              <input type="hidden" name="utmTerm" value={searchParams.get("utm_term") ?? ""} />
              <div>
                <label className="mb-1 block text-xs font-medium">Your name</label>
                <input
                  name="name"
                  required
                  className="w-full rounded-lg border border-foreground/15 bg-field px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Phone (WhatsApp)</label>
                <input
                  name="phone"
                  required
                  inputMode="tel"
                  placeholder="0803 123 4567"
                  className="w-full rounded-lg border border-foreground/15 bg-field px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Email (optional)</label>
                <input
                  name="email"
                  type="email"
                  className="w-full rounded-lg border border-foreground/15 bg-field px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Message (optional)</label>
                <textarea
                  name="message"
                  rows={2}
                  placeholder="I'd like to know more about…"
                  className="w-full rounded-lg border border-foreground/15 bg-field px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              {state && !state.ok ? <p className="text-sm font-medium text-error">{state.error}</p> : null}
              <button
                type="submit"
                disabled={pending}
                aria-busy={pending}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: accent }}
              >
                {pending ? "Sending…" : "Send inquiry"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
