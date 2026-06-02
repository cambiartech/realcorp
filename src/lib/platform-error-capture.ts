import { Prisma } from "@/generated/prisma";
import prisma from "@/lib/db";

export type PlatformErrorCaptureInput = {
  digest: string;
  name?: string | null;
  message?: string | null;
  stack?: string | null;
  routePath?: string | null;
  requestUrl?: string | null;
  tenantSlug?: string | null;
  tenantId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
};

function cleanText(value: unknown, max = 2000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export function normalizeErrorDigest(value: unknown): string | null {
  const digest = cleanText(value, 128);
  if (!digest) return null;
  return digest.replace(/\s+/g, "");
}

export function guessTenantSlugFromPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const first = pathname.split("/").filter(Boolean)[0] || null;
  if (!first) return null;
  const reserved = new Set(["api", "platform", "login", "join", "auth", "f", "privacy", "terms"]);
  return reserved.has(first) ? null : first;
}

export function cleanErrorMetadata(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "object") return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

export async function capturePlatformErrorEvent(input: PlatformErrorCaptureInput): Promise<void> {
  const digest = normalizeErrorDigest(input.digest);
  if (!digest) return;

  const routePath = cleanText(input.routePath, 512);
  const tenantSlug = input.tenantSlug ?? guessTenantSlugFromPath(routePath);

  let tenantId = input.tenantId ?? null;
  if (!tenantId && tenantSlug) {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true },
    });
    tenantId = tenant?.id ?? null;
  }

  await prisma.platformErrorEvent.create({
    data: {
      digest,
      name: cleanText(input.name, 128),
      message: cleanText(input.message, 2000),
      stack: cleanText(input.stack, 12000),
      routePath,
      requestUrl: cleanText(input.requestUrl, 1200),
      tenantSlug,
      tenantId,
      userId: input.userId ?? null,
      userEmail: cleanText(input.userEmail, 320),
      userAgent: cleanText(input.userAgent, 1024),
      metadata: input.metadata,
    },
  });
}
