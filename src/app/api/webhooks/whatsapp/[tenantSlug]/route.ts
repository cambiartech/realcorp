import prisma from "@/lib/db";
import { phoneVariants, canonicalPhone } from "@/lib/phone";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await params;
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (!mode || !token || !challenge) return new NextResponse("Bad request", { status: 400 });

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { settings: { select: { whatsappVerifyToken: true } } },
  });
  if (!tenant?.settings?.whatsappVerifyToken) return new NextResponse("Not configured", { status: 404 });
  if (mode === "subscribe" && token === tenant.settings.whatsappVerifyToken) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });
  if (!tenant) return NextResponse.json({ ok: false, error: "Tenant not found" }, { status: 404 });

  const payload = body as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          messages?: Array<{ id?: string; from?: string; timestamp?: string; text?: { body?: string } }>;
          metadata?: { display_phone_number?: string };
        };
      }>;
    }>;
  };

  const tenantLeads = await prisma.lead.findMany({
    where: { tenantId: tenant.id, phone: { not: null } },
    select: { id: true, phone: true },
    take: 5000,
  });
  const records: Array<{
    waMessageId: string | null;
    fromPhone: string | null;
    toPhone: string | null;
    body: string;
    timestamp: Date;
    leadId: string | null;
  }> = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const toPhone = canonicalPhone(value?.metadata?.display_phone_number);
      for (const msg of value?.messages ?? []) {
        const fromPhone = canonicalPhone(msg.from);
        if (!fromPhone) continue;
        const inboundVariants = new Set(phoneVariants(fromPhone));
        const matchedLead = tenantLeads.find((l) => {
          const leadVariants = phoneVariants(l.phone);
          return leadVariants.some((v) => inboundVariants.has(v));
        });
        const leadId = matchedLead?.id ?? null;
        const bodyText = msg.text?.body?.trim();
        if (!bodyText) continue;
        records.push({
          waMessageId: msg.id ?? null,
          fromPhone,
          toPhone,
          body: bodyText,
          timestamp: msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date(),
          leadId,
        });
      }
    }
  }

  if (records.length > 0) {
    await prisma.whatsAppMessage.createMany({
      data: records.map((r) => ({
        tenantId: tenant.id,
        leadId: r.leadId,
        direction: "INBOUND",
        waMessageId: r.waMessageId,
        fromPhone: r.fromPhone,
        toPhone: r.toPhone,
        body: r.body,
        timestamp: r.timestamp,
      })),
    });
  }

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      module: "SALES",
      entityType: "WHATSAPP_WEBHOOK",
      action: "RECEIVED",
      summary: `Inbound WhatsApp webhook received (${records.length} messages).`,
      metadata: body as object,
    },
  });

  return NextResponse.json({ ok: true });
}
