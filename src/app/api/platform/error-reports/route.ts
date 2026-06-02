import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  capturePlatformErrorEvent,
  cleanErrorMetadata,
  normalizeErrorDigest,
} from "@/lib/platform-error-capture";

async function parseBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await request.json()) as Record<string, unknown>;
  }
  const text = await request.text();
  if (!text.trim()) return {};
  return JSON.parse(text) as Record<string, unknown>;
}

function cleanText(value: unknown, max = 2000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request);
    const digest = normalizeErrorDigest(body.digest);
    if (!digest) {
      return NextResponse.json({ ok: false, error: "Missing error reference." }, { status: 400 });
    }

    const pathname = cleanText(body.pathname, 512);
    const session = await auth();

    await capturePlatformErrorEvent({
      digest,
      name: cleanText(body.name, 128),
      message: cleanText(body.message, 2000),
      stack: cleanText(body.stack, 12000),
      routePath: pathname,
      requestUrl: cleanText(body.requestUrl, 1200),
      userId: session?.user?.id || null,
      userEmail: session?.user?.email || null,
      userAgent: cleanText(body.userAgent, 1024),
      metadata: cleanErrorMetadata(body.metadata ?? { source: "global-error-boundary" }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[platform-error-reports] capture failed", err);
    return NextResponse.json({ ok: false, error: "Could not capture error report." }, { status: 500 });
  }
}
