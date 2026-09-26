import { NextResponse } from "next/server";
import { listingIdFromWebhook } from "@/lib/channels/airbnb/parse";
import { syncAirbnbTenant } from "@/lib/channels/airbnb/sync";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Airbnb tells us a listing or reservation changed. The body is only a hint.
 * The apartments are re-read with the host token, then Pellows is notified.
 */
export async function POST(request: Request) {
  const expected = process.env.AIRBNB_WEBHOOK_SECRET?.trim();
  if (expected) {
    const header = request.headers.get("authorization") || "";
    const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
    const given = request.headers.get("x-airbnb-webhook-secret") || bearer;
    if (given !== expected) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const raw = await request.text();
  let json: unknown = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const listingId = listingIdFromWebhook(json);
  if (!listingId) return NextResponse.json({ ok: true, ignored: true });
  const unit = await prisma.shortletUnit.findFirst({
    where: { airbnbListingId: listingId },
    select: { tenantId: true },
  });
  if (!unit) return NextResponse.json({ ok: true, ignored: true });
  const result = await syncAirbnbTenant(unit.tenantId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true, listings: result.listings });
}
