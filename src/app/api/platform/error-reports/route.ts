import { NextResponse } from "next/server";
import {
  capturePlatformErrorEvent,
  cleanErrorMetadata,
  normalizeErrorDigest,
} from "@/lib/platform-error-capture";

function cleanText(value: unknown, max = 2000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown> = {};
    try {
      const text = await request.text();
      if (text.trim()) body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
    }

    const digest = normalizeErrorDigest(body.digest);
    if (!digest) {
      return NextResponse.json({ ok: false, error: "Missing error reference." }, { status: 400 });
    }

    // Auth is best-effort — don't fail the report if session is unavailable
    let userId: string | null = null;
    let userEmail: string | null = null;
    try {
      const { auth } = await import("@/auth");
      const session = await auth();
      userId = session?.user?.id ?? null;
      userEmail = session?.user?.email ?? null;
    } catch {
      // session unavailable — continue without it
    }

    await capturePlatformErrorEvent({
      digest,
      name: cleanText(body.name, 128),
      message: cleanText(body.message, 2000),
      stack: cleanText(body.stack, 12000),
      routePath: cleanText(body.pathname, 512),
      requestUrl: cleanText(body.requestUrl, 1200),
      userId,
      userEmail,
      userAgent: cleanText(body.userAgent, 1024),
      metadata: cleanErrorMetadata(body.metadata ?? { source: "global-error-boundary" }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[error-reports] capture failed:", err);
    return NextResponse.json({ ok: false, error: "Could not capture error report." }, { status: 500 });
  }
}
