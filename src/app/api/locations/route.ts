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

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") || "countries";
  const country = code(request.nextUrl.searchParams.get("country"));
  const state = (request.nextUrl.searchParams.get("state") || "").trim();

  try {
    if (type === "countries") {
      return NextResponse.json(await listCatalogCountries(), {
        headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
      });
    }
    if (type === "states" && /^[A-Z]{2}$/.test(country)) {
      return NextResponse.json(await listLocationStates(country), {
        headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
      });
    }
    if (type === "cities" && /^[A-Z]{2}$/.test(country) && state) {
      return NextResponse.json(await listLocationCities(country, state), {
        headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
      });
    }
    return NextResponse.json({ error: "Invalid location query." }, { status: 400 });
  } catch (error) {
    console.error("Location catalog failed", error);
    return NextResponse.json({ error: "Location data is temporarily unavailable." }, { status: 503 });
  }
}
