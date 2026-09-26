import { NextResponse } from "next/server";
import { CHANNEL_PULL_LIMIT_PER_HOUR } from "@/lib/channels/calendar";
import { loadChannelUnits } from "@/lib/channels/load-units";
import { loadChannelOrganization } from "@/lib/channels/organization";
import { parseUpdatedSince } from "@/lib/channels/pellows-feed";
import { authorizeChannelPull, channelError } from "@/lib/channels/pull-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId")?.trim() || null;
  const updatedSince = parseUpdatedSince(url.searchParams.get("updatedSince"));
  if (updatedSince === "invalid") return channelError(400, "invalid_updated_since");

  const auth = await authorizeChannelPull(request, tenantId);
  if ("response" in auth) return auth.response;

  const [units, organization] = await Promise.all([
    loadChannelUnits(auth.tenantId, auth.timeZone, { updatedSince }),
    loadChannelOrganization(auth.tenantId),
  ]);
  return NextResponse.json(
    {
      tenantName: organization?.name || auth.tenantName,
      logoUrl: organization?.logoUrl ?? null,
      organization,
      units,
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-RateLimit-Limit": String(CHANNEL_PULL_LIMIT_PER_HOUR),
      },
    },
  );
}
