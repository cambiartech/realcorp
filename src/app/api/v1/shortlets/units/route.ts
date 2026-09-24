import { NextResponse } from "next/server";
import { CHANNEL_PULL_LIMIT_PER_HOUR } from "@/lib/channels/calendar";
import { loadChannelUnits } from "@/lib/channels/load-units";
import { authorizeChannelPull } from "@/lib/channels/pull-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tenantId = new URL(request.url).searchParams.get("tenantId")?.trim() || null;
  const auth = await authorizeChannelPull(request, tenantId);
  if ("response" in auth) return auth.response;

  const units = await loadChannelUnits(auth.tenantId, auth.timeZone);
  return NextResponse.json(
    { units },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-RateLimit-Limit": String(CHANNEL_PULL_LIMIT_PER_HOUR),
      },
    },
  );
}
