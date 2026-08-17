import { citiesForState, resolveNigeriaStateName } from "@/lib/nigeria-locations";
import { NextRequest, NextResponse } from "next/server";

const CACHE = {
  "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
};

export async function GET(req: NextRequest) {
  const state = req.nextUrl.searchParams.get("state")?.trim() ?? "";
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!state) {
    return NextResponse.json({ error: "state query param required" }, { status: 400 });
  }

  const resolved = resolveNigeriaStateName(state);
  const all = citiesForState(resolved);
  const cities = q ? all.filter((city) => city.toLowerCase().includes(q.toLowerCase())) : all;
  return NextResponse.json(
    {
      state: resolved,
      cities,
      total: all.length,
      kind: "LGA",
      source: "catalog",
    },
    { headers: CACHE },
  );
}
