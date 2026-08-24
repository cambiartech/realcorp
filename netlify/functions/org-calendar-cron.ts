const schedule = "0 7 * * *";

export default async function handler() {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  const secret = process.env.CRON_SECRET || process.env.AUTH_SECRET || "";
  if (!base || !secret) {
    return { statusCode: 500, body: "Missing URL or AUTH_SECRET" };
  }
  const res = await fetch(`${base.replace(/\/$/, "")}/api/cron/org-calendar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.text();
  return { statusCode: res.status, body };
}

export const config = { schedule };
