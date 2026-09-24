import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { CHANNEL_PULL_LIMIT_PER_HOUR, CHANNEL_PULL_WINDOW_MS } from "@/lib/channels/calendar";
import { bearerToken, hashChannelToken } from "@/lib/channels/tokens";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function takeBucket(key: string, limit: number): { limited: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || entry.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + CHANNEL_PULL_WINDOW_MS });
    if (buckets.size > 5000) {
      for (const [id, value] of buckets) {
        if (value.resetAt < now) buckets.delete(id);
      }
    }
    return { limited: false, retryAfter: Math.ceil(CHANNEL_PULL_WINDOW_MS / 1000) };
  }
  entry.count += 1;
  const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  return { limited: entry.count > limit, retryAfter };
}

export function channelError(status: number, error: string, headers?: Record<string, string>) {
  return NextResponse.json({ error }, { status, headers });
}

export async function authorizeChannelPull(request: Request, tenantId: string | null) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const ipLimit = takeBucket(`ip:${ip}`, 120);
  if (ipLimit.limited) {
    return {
      response: channelError(429, "rate_limited", { "Retry-After": String(ipLimit.retryAfter) }),
    };
  }

  const raw = bearerToken(request.headers.get("authorization"));
  if (!raw) return { response: channelError(401, "unauthorized") };

  const tokenLimit = takeBucket(`token:${hashChannelToken(raw)}`, CHANNEL_PULL_LIMIT_PER_HOUR);
  if (tokenLimit.limited) {
    return {
      response: channelError(429, "rate_limited", {
        "Retry-After": String(tokenLimit.retryAfter),
        "X-RateLimit-Limit": String(CHANNEL_PULL_LIMIT_PER_HOUR),
      }),
    };
  }

  const connection = await prisma.channelConnection.findUnique({
    where: { tokenHash: hashChannelToken(raw) },
    select: {
      id: true,
      tenantId: true,
      status: true,
      revokedAt: true,
      scopes: true,
      tenant: { select: { id: true, defaultTimezone: true } },
    },
  });
  if (!connection || connection.status !== "ACTIVE" || connection.revokedAt || !connection.scopes.includes("shortlets.read")) {
    return { response: channelError(401, "unauthorized") };
  }
  if (!tenantId) return { response: channelError(404, "tenant_not_found") };
  if (connection.tenantId !== tenantId) return { response: channelError(403, "forbidden") };
  if (!connection.tenant) return { response: channelError(404, "tenant_not_found") };

  await prisma.channelConnection.update({
    where: { id: connection.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    tenantId: connection.tenantId,
    timeZone: connection.tenant.defaultTimezone || "Africa/Lagos",
  };
}
