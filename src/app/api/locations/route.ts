import { NextRequest, NextResponse } from "next/server";
import {
  listCatalogCountries,
  listLocationCities,
  listLocationStates,
} from "@/lib/location-catalog";

export const runtime = "nodejs";

function code(value: string | null) {
  return (value || "").trim().toUpperCase();
}

const CACHE = {
  "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
};

function payload(type: "countries" | "states" | "cities", items: unknown[]) {
  return NextResponse.json({ type, items }, { headers: CACHE });
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
    return NextResponse.json({ error: "Invalid location query." }, { status: 400 });
  } catch (error) {
    console.error("Location catalog failed", error);
    return NextResponse.json(
      { error: "Location data is temporarily unavailable." },
      { status: 503 },
    );
  }
}
