/**
 * Meta Lead Ads webhook for a specific tenant.
 *
 * GET  — webhook verification handshake (Meta sends hub.challenge)
 * POST — new lead notification payload
 *
 * Setup in Meta Business Suite:
 *   Callback URL: https://yourapp.com/api/webhooks/meta-leads/{tenantSlug}
 *   Verify Token: the value stored in TenantSettings.metaVerifyToken
 *   Subscribe to: leadgen
 */

import prisma from "@/lib/db";
import { recalculateLeadScore } from "@/lib/lead-scoring";
import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// GET — verification handshake
// ---------------------------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await params;
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token || !challenge) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const settings = await prisma.tenantSettings.findFirst({
    where: { tenant: { slug: tenantSlug } },
    select: { metaVerifyToken: true },
  });

  if (!settings?.metaVerifyToken || settings.metaVerifyToken !== token) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return new NextResponse(challenge, { status: 200 });
}

// ---------------------------------------------------------------------------
// POST — new lead event
// ---------------------------------------------------------------------------
type MetaLeadField = { name: string; values: string[] };
type MetaLeadEntry = {
  id: string;
  form_id: string;
  page_id: string;
  field_data?: MetaLeadField[];
};
type MetaPayload = {
  object: string;
  entry?: Array<{ changes?: Array<{ field: string; value: MetaLeadEntry }> }>;
};

function extractField(fields: MetaLeadField[], ...names: string[]): string | null {
  for (const name of names) {
    const f = fields.find((f) => f.name.toLowerCase() === name.toLowerCase());
    if (f?.values?.[0]) return f.values[0];
  }
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await params;

  // Verify X-Hub-Signature-256 — optional but strongly recommended in production.
  // For now we trust the payload and rely on the verify token already validated
  // during setup. Add HMAC verification here when you have the app secret.

  let payload: MetaPayload;
  try {
    payload = (await req.json()) as MetaPayload;
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  if (payload.object !== "page" && payload.object !== "leadgen") {
    return NextResponse.json({ status: "ignored" });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      settings: {
        select: {
          metaPageAccessToken: true,
          metaDefaultSource: true,
        },
      },
    },
  });
  if (!tenant) return new NextResponse("Not found", { status: 404 });

  const pageAccessToken = tenant.settings?.metaPageAccessToken;
  const source = tenant.settings?.metaDefaultSource ?? "Facebook";

  const createdIds: string[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue;
      const value = change.value;
      if (!value?.id) continue;

      let fields: MetaLeadField[] = value.field_data ?? [];

      // If Meta didn't inline field_data, fetch it from the Graph API
      if (!fields.length && pageAccessToken) {
        try {
          const resp = await fetch(
            `https://graph.facebook.com/v19.0/${value.id}?fields=field_data&access_token=${pageAccessToken}`,
          );
          const data = (await resp.json()) as { field_data?: MetaLeadField[] };
          fields = data.field_data ?? [];
        } catch {
          // Continue without enrichment
        }
      }

      const name =
        extractField(fields, "full_name", "name", "first_name") ??
        `Meta lead ${value.id.slice(-6)}`;
      const email = extractField(fields, "email");
      const phone = extractField(fields, "phone_number", "phone");
      const project = extractField(fields, "property", "project", "project_interest");
      const budget = extractField(fields, "budget", "budget_range");

      const lead = await prisma.lead.create({
        data: {
          tenantId: tenant.id,
          name,
          email,
          phone,
          source,
          projectInterest: project,
          budgetRange: budget,
          utmSource: "meta",
          utmMedium: "lead_ads",
          utmCampaign: value.form_id,
        },
      });
      createdIds.push(lead.id);
      void recalculateLeadScore(lead.id);
    }
  }

  return NextResponse.json({ ok: true, created: createdIds.length });
}
