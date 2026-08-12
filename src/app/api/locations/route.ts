import {
  getCitiesOfState,
  getCountries,
  getStatesOfCountry,
} from "@countrystatecity/countries";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function code(value: string | null) {
  return (value || "").trim().toUpperCase();
}

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") || "countries";
  const country = code(request.nextUrl.searchParams.get("country"));
  const state = code(request.nextUrl.searchParams.get("state"));

  try {
    if (type === "countries") {
      const rows = await getCountries();
      return NextResponse.json(
        rows
          .map((row) => ({ code: row.iso2, name: row.name, emoji: row.emoji }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        { headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } },
      );
    }
    if (type === "states" && /^[A-Z]{2}$/.test(country)) {
      const rows = await getStatesOfCountry(country);
      return NextResponse.json(
        rows
          .map((row) => ({ code: row.iso2, name: row.name, type: row.type }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        { headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } },
      );
    }
    if (type === "cities" && /^[A-Z]{2}$/.test(country) && state) {
      const rows = await getCitiesOfState(country, state);
      return NextResponse.json(
        rows
          .map((row) => ({ id: row.id, name: row.name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        { headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } },
      );
    }
    return NextResponse.json({ error: "Invalid location query." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Location data is temporarily unavailable." }, { status: 503 });
  }
}
