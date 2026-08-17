import { NIGERIA_STATES } from "@/lib/nigeria-locations";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { states: [...NIGERIA_STATES], source: "catalog" },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
