import prisma from "@/lib/db";
import { phoneVariants, canonicalPhone } from "@/lib/phone";
import { handleBotMessage } from "@/lib/whatsapp-bot";
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

type WebhookMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  image?: { caption?: string };
  video?: { caption?: string };
  document?: { caption?: string; filename?: string };
  audio?: Record<string, unknown>;
  sticker?: Record<string, unknown>;
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
  button?: { text?: string };
  interactive?: {
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string };
  };
};

type WebhookStatus = {
  id?: string;
  status?: string; // sent | delivered | read | failed
  timestamp?: string;
};

/** Extract a readable body from any supported inbound message type. */
function extractMessageBody(msg: WebhookMessage): string | null {
  switch (msg.type) {
    case "text":
      return msg.text?.body?.trim() || null;
    case "image":
      return `[Image]${msg.image?.caption ? ` ${msg.image.caption}` : ""}`;
    case "video":
      return `[Video]${msg.video?.caption ? ` ${msg.video.caption}` : ""}`;
    case "document":
      return `[Document${msg.document?.filename ? `: ${msg.document.filename}` : ""}]${
        msg.document?.caption ? ` ${msg.document.caption}` : ""
      }`;
    case "audio":
      return "[Voice note / audio]";
    case "sticker":
      return "[Sticker]";
    case "location": {
      const loc = msg.location;
      const label = [loc?.name, loc?.address].filter(Boolean).join(", ");
      const coords =
        loc?.latitude != null && loc?.longitude != null ? `(${loc.latitude}, ${loc.longitude})` : "";
      return `[Location] ${label || coords}`.trim();
    }
    case "button":
      return msg.button?.text?.trim() || "[Button reply]";
    case "interactive":
      return (
        msg.interactive?.button_reply?.title?.trim() ||
        msg.interactive?.list_reply?.title?.trim() ||
        "[Interactive reply]"
      );
    default:
      return msg.text?.body?.trim() || null;
  }
}

const TRACKED_STATUSES = new Set(["sent", "delivered", "read", "failed"]);
/** Never downgrade a status (e.g. read -> delivered when events arrive out of order). */
const STATUS_RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: 4 };

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
    select: {
      id: true,
      name: true,
      slug: true,
      settings: {
        select: {
          whatsappBotEnabled: true,
          whatsappAccessToken: true,
          whatsappPhoneNumberId: true,
          moduleWhatsApp: true,
        },
      },
    },
  });
  if (!tenant) return NextResponse.json({ ok: false, error: "Tenant not found" }, { status: 404 });
  // WhatsApp module disabled by platform admin: acknowledge but do not process.
  if (tenant.settings?.moduleWhatsApp === false) return NextResponse.json({ ok: true });

  const payload = body as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          messages?: WebhookMessage[];
          statuses?: WebhookStatus[];
          metadata?: { display_phone_number?: string };
          contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
        };
      }>;
    }>;
  };

  // ---------------------------------------------------------------
  // 1. Delivery/read status updates for outbound messages
  // ---------------------------------------------------------------
  let statusUpdates = 0;
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const st of change.value?.statuses ?? []) {
        if (!st.id || !st.status || !TRACKED_STATUSES.has(st.status)) continue;
        const existing = await prisma.whatsAppMessage.findFirst({
          where: { tenantId: tenant.id, waMessageId: st.id },
          select: { id: true, status: true },
        });
        if (!existing) continue;
        const currentRank = existing.status ? (STATUS_RANK[existing.status] ?? 0) : 0;
        const nextRank = STATUS_RANK[st.status] ?? 0;
        if (nextRank <= currentRank) continue;
        await prisma.whatsAppMessage.update({
          where: { id: existing.id },
          data: {
            status: st.status,
            statusUpdatedAt: st.timestamp ? new Date(Number(st.timestamp) * 1000) : new Date(),
          },
        });
        statusUpdates += 1;
      }
    }
  }

  // ---------------------------------------------------------------
  // 2. Inbound messages
  // ---------------------------------------------------------------
  const candidates: Array<{
    waMessageId: string | null;
    fromPhone: string | null;
    rawFrom: string | null;
    toPhone: string | null;
    body: string;
    timestamp: Date;
    profileName: string | null;
    text: string | null;
    interactiveReplyId: string | null;
  }> = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const toPhone = canonicalPhone(value?.metadata?.display_phone_number);
      for (const msg of value?.messages ?? []) {
        const fromPhone = canonicalPhone(msg.from);
        if (!fromPhone) continue;
        const bodyText = extractMessageBody(msg);
        if (!bodyText) continue;
        const profileName =
          value?.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name ??
          value?.contacts?.[0]?.profile?.name ??
          null;
        candidates.push({
          waMessageId: msg.id ?? null,
          fromPhone,
          rawFrom: msg.from ?? null,
          toPhone,
          body: bodyText,
          timestamp: msg.timestamp ? new Date(Number(msg.timestamp) * 1000) : new Date(),
          profileName,
          text: msg.type === "text" || !msg.type ? (msg.text?.body?.trim() || null) : null,
          interactiveReplyId:
            msg.interactive?.button_reply?.id ?? msg.interactive?.list_reply?.id ?? null,
        });
      }
    }
  }

  let saved = 0;
  let fresh: typeof candidates = [];
  if (candidates.length > 0) {
    // Dedup: Meta retries webhooks, so skip messages we already stored.
    const ids = candidates.map((c) => c.waMessageId).filter((id): id is string => Boolean(id));
    const existing = ids.length
      ? await prisma.whatsAppMessage.findMany({
          where: { tenantId: tenant.id, waMessageId: { in: ids } },
          select: { waMessageId: true },
        })
      : [];
    const seen = new Set(existing.map((e) => e.waMessageId));
    fresh = candidates.filter((c) => !c.waMessageId || !seen.has(c.waMessageId));

    if (fresh.length > 0) {
      // Match leads only by the phone variants of the senders in this payload.
      const allVariants = Array.from(new Set(fresh.flatMap((c) => phoneVariants(c.fromPhone))));
      const tenantLeads = allVariants.length
        ? await prisma.lead.findMany({
            where: { tenantId: tenant.id, phone: { not: null } },
            select: { id: true, phone: true },
            take: 5000,
          })
        : [];

      const records = fresh.map((c) => {
        const inboundVariants = new Set(phoneVariants(c.fromPhone));
        const matchedLead = tenantLeads.find((l) =>
          phoneVariants(l.phone).some((v) => inboundVariants.has(v)),
        );
        return { ...c, leadId: matchedLead?.id ?? null };
      });

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
      saved = records.length;
    }
  }

  // ---------------------------------------------------------------
  // 3. Realcorp Bot — auto-reply to fresh inbound messages
  // ---------------------------------------------------------------
  const settings = tenant.settings;
  if (
    fresh.length > 0 &&
    settings?.whatsappBotEnabled &&
    settings.whatsappAccessToken &&
    settings.whatsappPhoneNumberId
  ) {
    const botTenant = {
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      phoneNumberId: settings.whatsappPhoneNumberId,
      accessToken: settings.whatsappAccessToken,
    };
    for (const msg of fresh) {
      // Reply to the raw WhatsApp sender id (already E.164-style digits)
      const to = msg.rawFrom ?? msg.fromPhone;
      if (!to) continue;
      await handleBotMessage(botTenant, {
        from: to,
        profileName: msg.profileName,
        text: msg.text,
        interactiveReplyId: msg.interactiveReplyId,
      });
    }
  }

  if (saved > 0 || statusUpdates > 0) {
    await prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        module: "SALES",
        entityType: "WHATSAPP_WEBHOOK",
        action: "RECEIVED",
        summary: `Inbound WhatsApp webhook (${saved} new messages, ${statusUpdates} status updates).`,
        metadata: body as object,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
