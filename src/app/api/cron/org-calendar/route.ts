import { NextResponse } from "next/server";
import { runOrgCalendarJobs } from "@/lib/org-calendar-jobs";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET || process.env.AUTH_SECRET || "";
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const query = new URL(request.url).searchParams.get("secret") || "";
  return bearer === secret || query === secret;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const summary = await runOrgCalendarJobs();
  return NextResponse.json({ ok: true, ...summary });
}

export async function POST(request: Request) {
  return GET(request);
}
