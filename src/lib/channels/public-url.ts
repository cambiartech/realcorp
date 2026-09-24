const PRIVATE_HOST =
  /^(localhost|0\.0\.0\.0|::1|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)$/i;

export function publicHttpsUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || PRIVATE_HOST.test(host) || host.endsWith(".local") || host.endsWith(".internal")) return null;
  return url.toString();
}

export function appOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || "";
  return raw.replace(/\/$/, "");
}

export function unitIcalUrl(feedToken: string): string {
  const origin = appOrigin();
  const path = `/ical/${feedToken}.ics`;
  return origin ? `${origin}${path}` : path;
}
