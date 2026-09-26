import { createHmac, timingSafeEqual } from "crypto";

type StatePayload = { tenantId: string; userId: string; exp: number };

function secret() {
  const value = process.env.AUTH_SECRET || "";
  if (value.length < 16) throw new Error("AUTH_SECRET is required.");
  return value;
}

export function signAirbnbState(payload: StatePayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readAirbnbState(state: string): StatePayload | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as StatePayload;
    if (!parsed.tenantId || !parsed.userId || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
