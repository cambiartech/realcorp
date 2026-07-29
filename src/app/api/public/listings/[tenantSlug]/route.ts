import { loadPublicListings } from "@/lib/public-listings";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Public listings API — designed to be called from any website, ad landing
 * page, or blog (CORS open). Returns only published projects.
 *
 * GET /api/public/listings/{tenantSlug}?q=&city=&purpose=&minPrice=&maxPrice=&limit=&offset=
 */

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Best-effort per-instance rate limit: 60 requests/minute per IP.
const RATE_LIMIT = 60;
const WINDOW_MS = 60_000;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    if (hits.size > 10_000) {
      for (const [key, value] of hits) {
        if (value.resetAt < now) hits.delete(key);
      }
    }
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

function parseNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded. Try again in a minute." },
      { status: 429, headers: CORS_HEADERS },
    );
  }

  const url = new URL(req.url);
  const result = await loadPublicListings(tenantSlug, {
    q: url.searchParams.get("q")?.trim() || undefined,
    city: url.searchParams.get("city")?.trim() || undefined,
    purpose: url.searchParams.get("purpose")?.trim() || undefined,
    minPrice: parseNumber(url.searchParams.get("minPrice")),
    maxPrice: parseNumber(url.searchParams.get("maxPrice")),
    limit: parseNumber(url.searchParams.get("limit")),
    offset: parseNumber(url.searchParams.get("offset")),
  });

  if (!result) {
    return NextResponse.json(
      { ok: false, error: "Organization not found" },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json(
    { ok: true, total: result.total, listings: result.listings },
    {
      headers: {
        ...CORS_HEADERS,
        // Let CDNs cache briefly — listings don't change second-to-second.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
