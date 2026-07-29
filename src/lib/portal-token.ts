import { createHash, randomBytes, timingSafeEqual } from "crypto";

export function generatePortalToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: sha256Hex(raw) };
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function verifyPortalToken(
  raw: string | null | undefined,
  storedHash: string | null | undefined,
): boolean {
  if (!raw || !storedHash) return false;
  const computed = sha256Hex(raw);
  if (computed.length !== storedHash.length || computed.length % 2 !== 0) return false;
  try {
    return timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(storedHash, "hex"));
  } catch {
    return false;
  }
}
