import { NextResponse } from "next/server";
import { loadFeedCalendar } from "@/lib/channels/load-units";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ feedToken: string }> }) {
  const { feedToken } = await context.params;
  const token = decodeURIComponent(feedToken).replace(/\.ics$/i, "");
  const body = await loadFeedCalendar(token);
  if (!body) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
