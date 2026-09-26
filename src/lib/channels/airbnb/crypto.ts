import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function key() {
  const secret = process.env.AUTH_SECRET || "";
  if (secret.length < 16) throw new Error("AUTH_SECRET is required to store the Airbnb connection.");
  return createHash("sha256").update(secret).digest();
}

export function sealToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, body]).toString("base64url");
}

export function openToken(cipherText: string): string {
  const raw = Buffer.from(cipherText, "base64url");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const body = raw.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}
