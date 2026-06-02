import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/db";

function cleanText(value: unknown, max = 2000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function cleanDigest(value: unknown): string | null {
  const digest = cleanText(value, 128);
  if (!digest) return null;
  return digest.replace(/\s+/g, "");
}

function guessTenantSlug(pathname: string | null): string | null {
  if (!pathname) return null;
  const first = pathname.split("/").filter(Boolean)[0] || null;
  if (!first) return null;
  const reserved = new Set([
    "api",
    "platform",
    "login",
    "join",
    "auth",
    "f",
    "privacy",
    "terms",
  ]);
  return reserved.has(first) ? null : first;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const digest = cleanDigest(body.digest);
    if (!digest) {
      return NextResponse.json({ ok: false, error: "Missing error reference." }, { status: 400 });
    }

    const pathname = cleanText(body.pathname, 512);
    const requestUrl = cleanText(body.requestUrl, 1200);
    const session = await auth();
    const userId = session?.user?.id || null;
    const userEmail = session?.user?.email || null;

    const tenantSlug = guessTenantSlug(pathname);
    const tenant = tenantSlug
      ? await prisma.tenant.findUnique({
          where: { slug: tenantSlug },
          select: { id: true },
        })
      : null;

    await prisma.platformErrorEvent.create({
      data: {
        digest,
        name: cleanText(body.name, 128),
        message: cleanText(body.message, 2000),
        stack: cleanText(body.stack, 12000),
        routePath: pathname,
        requestUrl,
        tenantSlug,
        tenantId: tenant?.id ?? null,
        userId,
        userEmail,
        userAgent: cleanText(body.userAgent, 1024),
        metadata:
          body.metadata && typeof body.metadata === "object"
            ? (body.metadata as Record<string, unknown>)
            : undefined,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not capture error report." }, { status: 500 });
  }
}
