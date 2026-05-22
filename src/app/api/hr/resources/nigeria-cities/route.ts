import { listNigeriaLgasFromDb } from "@/lib/nigeria-locations-sync";
import { citiesForState } from "@/lib/nigeria-locations";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state")?.trim() ?? "";
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!state) {
    return NextResponse.json({ error: "state query param required" }, { status: 400 });
  }

  try {
    const result = await listNigeriaLgasFromDb(state, q || undefined);
    if (result.cities.length > 0) {
      return NextResponse.json({
        state: result.state,
        cities: result.cities,
        total: result.total,
        kind: "LGA",
        source: "db",
      });
    }
  } catch (err) {
    console.error("nigeria-cities db", err);
  }

  const fallback = citiesForState(state).filter((c) => c !== "Other");
  const filtered = q ? fallback.filter((c) => c.toLowerCase().includes(q.toLowerCase())) : fallback;
  return NextResponse.json({
    state,
    cities: filtered,
    total: filtered.length,
    kind: "city",
    source: "fallback",
  });
}
