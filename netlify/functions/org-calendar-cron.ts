const schedule = "0 7 * * *";

export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  const secret = process.env.CRON_SECRET || process.env.AUTH_SECRET || "";
  if (!base || !secret) {
    return new Response("Missing URL or secret", { status: 500 });
  }
  const res = await fetch(`${base.replace(/\/$/, "")}/api/cron/org-calendar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.text();
  return new Response(body, { status: res.status, headers: { "content-type": "application/json" } });
};

export const config = { schedule };
