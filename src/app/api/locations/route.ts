import { NextRequest, NextResponse } from "next/server";
import {
  listCatalogCountries,
  listLocationCities,
  listLocationStates,
} from "@/lib/location-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function code(value: string | null) {
  return (value || "").trim().toUpperCase();
}

/**
 * Never let a CDN / Next static cache reuse one `/api/locations` response for
 * another query. A cached countries payload on `?type=states` is what locked
 * the state/city dropdowns (country loaded, states rejected).
 */
const NO_STORE = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  "Netlify-CDN-Cache-Control": "no-store",
  Vary: "Accept, Accept-Encoding",
};

function payload(type: "countries" | "states" | "cities", items: unknown[]) {
  return NextResponse.json({ type, items }, { headers: NO_STORE });
}

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") || "countries";
  const country = code(request.nextUrl.searchParams.get("country"));
  const state = (request.nextUrl.searchParams.get("state") || "").trim();

  try {
    if (type === "countries") {
      return payload("countries", await listCatalogCountries());
    }
    if (type === "states" && /^[A-Z]{2}$/.test(country)) {
      return payload("states", await listLocationStates(country));
    }
    if (type === "cities" && /^[A-Z]{2}$/.test(country) && state) {
      return payload("cities", await listLocationCities(country, state));
    }
    return NextResponse.json(
      { error: "Invalid location query." },
      { status: 400, headers: NO_STORE },
    );
  } catch (error) {
    console.error("Location catalog failed", error);
    return NextResponse.json(
      { error: "Location data is temporarily unavailable." },
      { status: 503, headers: NO_STORE },
    );
  }
}
