/**
 * Generic inbound lead webhook — works with Zapier, Make (Integromat), n8n,
 * Typeform, Tally, Webflow forms, or any HTTP POST from a third-party platform.
 *
 * POST /api/webhooks/inbound-lead/{tenantSlug}
 *
 * Authentication: Bearer token in Authorization header OR ?token= query param.
 * The token is a random string you generate in Settings → Integrations (stored
 * as TenantSettings.webhookSecret — added in a later migration). For now we use
 * metaVerifyToken as a shared secret to avoid another migration.
 *
 * Accepted body (JSON or form-urlencoded):
 *   name         string   – lead full name
 *   email        string   – email address
 *   phone        string   – phone number
 *   source       string   – traffic source label (e.g. "Typeform", "Webflow")
 *   project      string   – project/property of interest
 *   budget       string   – budget range
 *   campaign     string   – campaign name
 *   utm_source   string   – UTM source
 *   utm_medium   string   – UTM medium
 *   utm_campaign string   – UTM campaign
 *   utm_content  string   – UTM content
 *
 * All fields except `name` are optional.
 * Returns { ok: true, leadId: string } on success.
 */

import prisma from "@/lib/db";
import { inboundLeadVisibilityData } from "@/lib/marketing-lead-routing";
import { recalculateLeadScore } from "@/lib/lead-scoring";
import { NextRequest, NextResponse } from "next/server";

type InboundPayload = Record<string, string | undefined>;

function str(v: unknown): string | null {
  if (typeof v === "string") return v.trim() || null;
  return null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;

  // ------------------------------------------------------------------
  // 1. Authenticate — Bearer token or ?token= query param
  // ------------------------------------------------------------------
  const authHeader = req.headers.get("authorization") ?? "";
  const queryToken = new URL(req.url).searchParams.get("token") ?? "";
  const incomingToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : queryToken;

  if (!incomingToken) {
    return NextResponse.json({ ok: false, error: "Missing auth token" }, { status: 401 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      settings: { select: { metaVerifyToken: true, metaDefaultSource: true, marketingLeadRouting: true } },
    },
  });
  if (!tenant) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const secret = tenant.settings?.metaVerifyToken;
  if (!secret || secret !== incomingToken) {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 403 });
  }

  // ------------------------------------------------------------------
  // 2. Parse body — support JSON and form-urlencoded
  // ------------------------------------------------------------------
  let body: InboundPayload = {};
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      body = (await req.json()) as InboundPayload;
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const sp = new URLSearchParams(text);
      sp.forEach((v, k) => {
        body[k] = v;
      });
    } else {
      // Try JSON first, fall back to text
      const text = await req.text();
      try {
        body = JSON.parse(text) as InboundPayload;
      } catch {
        /* ignore */
      }
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Could not parse body" }, { status: 400 });
  }

  // ------------------------------------------------------------------
  // 3. Extract fields — accept common aliases
  // ------------------------------------------------------------------
  const combinedName = [str(body.first_name), str(body.last_name)].filter(Boolean).join(" ") || null;
  const name = str(body.name) ?? combinedName;

  if (!name) {
    return NextResponse.json({ ok: false, error: "Field `name` is required" }, { status: 422 });
  }

  const email = str(body.email);
  const phone = str(body.phone) ?? str(body.phone_number) ?? str(body.mobile);
  const source = str(body.source) ?? str(body.lead_source) ?? tenant.settings?.metaDefaultSource ?? "Webhook";
  const projectInterest = str(body.project) ?? str(body.property) ?? str(body.project_interest);
  const budgetRange = str(body.budget) ?? str(body.budget_range);
  const campaignName = str(body.campaign) ?? str(body.campaign_name);
  const utmSource = str(body.utm_source);
  const utmMedium = str(body.utm_medium);
  const utmCampaign = str(body.utm_campaign);
  const utmContent = str(body.utm_content);

  // ------------------------------------------------------------------
  // 4. Create lead + score
  // ------------------------------------------------------------------
  const lead = await prisma.lead.create({
    data: {
      tenantId: tenant.id,
      name,
      email,
      phone,
      source,
      projectInterest,
      budgetRange,
      campaignName,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      ...inboundLeadVisibilityData(tenant.settings?.marketingLeadRouting),
    },
  });

  void recalculateLeadScore(lead.id);

  return NextResponse.json({ ok: true, leadId: lead.id }, { status: 201 });
}
