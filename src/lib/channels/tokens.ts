import { createHash, randomBytes, timingSafeEqual } from "crypto";

export function hashChannelToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

export function generateChannelToken(): { raw: string; hash: string; prefix: string } {
  const raw = `rc_${randomBytes(32).toString("base64url")}`;
  return { raw, hash: hashChannelToken(raw), prefix: `${raw.slice(0, 10)}…` };
}

export function generateFeedToken(): string {
  return randomBytes(24).toString("base64url");
}

export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(\S+)$/i);
  const token = match?.[1]?.trim();
  return token || null;
}

export function tokenMatchesHash(raw: string, storedHash: string): boolean {
  const computed = hashChannelToken(raw);
  if (computed.length !== storedHash.length || computed.length % 2 !== 0) return false;
  try {
    return timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(storedHash, "hex"));
  } catch {
    return false;
  }
}
