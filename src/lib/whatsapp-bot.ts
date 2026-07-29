import prisma from "@/lib/db";
import { phoneVariants } from "@/lib/phone";
import { loadPublicListings, type PublicListing } from "@/lib/public-listings";
import { sendWhatsAppButtons, sendWhatsAppImage, sendWhatsAppList, sendWhatsAppText } from "@/lib/whatsapp";

/**
 * Realcorp Bot — menu-driven WhatsApp assistant.
 *
 * Stateless by design: every interactive row/button carries its intent in its
 * id (e.g. "bot:listing:<projectId>"), so no conversation state table is
 * needed. Free text goes through `intelligence.handleFreeText`, which is the
 * seam where an AI model plugs in later — today it returns null and the bot
 * falls back to the menu.
 */

export type BotInboundMessage = {
  from: string; // normalized sender phone
  profileName: string | null;
  text: string | null;
  interactiveReplyId: string | null;
};

export type BotTenantContext = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  phoneNumberId: string;
  accessToken: string;
};

// ---------------------------------------------------------------------------
// AI seam — replace defaultIntelligence with an LLM-backed handler later.
// Return a reply string to short-circuit the menu, or null to fall through.
// ---------------------------------------------------------------------------
export type BotIntelligence = {
  handleFreeText: (params: {
    tenant: BotTenantContext;
    message: BotInboundMessage;
    listings: PublicListing[];
  }) => Promise<string | null>;
};

const defaultIntelligence: BotIntelligence = {
  handleFreeText: async () => null,
};

// Row/button id grammar
const ID = {
  menu: "bot:menu",
  listings: "bot:listings",
  agent: "bot:agent",
  listing: (projectId: string) => `bot:listing:${projectId}`,
  book: (projectId: string) => `bot:book:${projectId}`,
};

const GREETING_RE = /^(hi|hello|hey|hallo|good\s*(morning|afternoon|evening)|menu|start|yo)\b/i;
const LISTINGS_RE =
  /(listing|propert|project|house|home|apartment|land|buy|rent|short\s*let|price|available)/i;
const AGENT_RE = /(agent|human|person|speak|talk|call\s*me|help)/i;

function formatPrice(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function listingPriceLabel(listing: PublicListing): string {
  if (listing.priceFrom == null) return "Price on request";
  if (listing.priceTo != null && listing.priceTo !== listing.priceFrom) {
    return `${formatPrice(listing.priceFrom, listing.currency)} – ${formatPrice(listing.priceTo, listing.currency)}`;
  }
  return `From ${formatPrice(listing.priceFrom, listing.currency)}`;
}

function listingRowDescription(listing: PublicListing): string {
  const location = [listing.city, listing.state].filter(Boolean).join(", ");
  return [listingPriceLabel(listing), location].filter(Boolean).join(" · ");
}

/** Record an outbound bot message so it appears in lead conversations and the inbox. */
async function recordBotReply(
  tenant: BotTenantContext,
  to: string,
  body: string,
  waMessageId: string | null,
  leadId: string | null,
) {
  try {
    await prisma.whatsAppMessage.create({
      data: {
        tenantId: tenant.tenantId,
        leadId,
        direction: "OUTBOUND",
        waMessageId,
        // No Meta message id means the Graph API call failed
        status: waMessageId ? null : "failed",
        fromPhone: tenant.phoneNumberId,
        toPhone: to,
        body,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error("[whatsapp-bot] failed to record reply", error);
  }
}

/** Find the lead for a phone, or create one sourced to the bot. */
async function ensureLead(
  tenant: BotTenantContext,
  phone: string,
  profileName: string | null,
): Promise<{ id: string; created: boolean }> {
  const variants = phoneVariants(phone);
  const existing = await prisma.lead.findFirst({
    where: { tenantId: tenant.tenantId, phone: { in: variants.length ? variants : [phone] } },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return { id: existing.id, created: false };

  const created = await prisma.lead.create({
    data: {
      tenantId: tenant.tenantId,
      name: profileName?.trim() || `WhatsApp ${phone.slice(-4)}`,
      phone,
      source: "WhatsApp Bot",
      notes: "Created automatically from a WhatsApp bot conversation.",
      lastActivityAt: new Date(),
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

async function createBotTask(tenant: BotTenantContext, leadId: string, title: string, body: string) {
  try {
    // Activities require a creator; attribute bot tasks to an org admin (or any member).
    const owner =
      (await prisma.membership.findFirst({
        where: { tenantId: tenant.tenantId, role: "ORG_ADMIN" },
        orderBy: { createdAt: "asc" },
        select: { userId: true },
      })) ??
      (await prisma.membership.findFirst({
        where: { tenantId: tenant.tenantId },
        orderBy: { createdAt: "asc" },
        select: { userId: true },
      }));
    if (!owner) return;

    await prisma.activity.create({
      data: {
        tenantId: tenant.tenantId,
        entityType: "LEAD",
        entityId: leadId,
        type: "TASK",
        status: "PENDING",
        title,
        body,
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdByUserId: owner.userId,
        assignedUserId: owner.userId,
      },
    });
  } catch (error) {
    console.error("[whatsapp-bot] failed to create task", error);
  }
}

async function sendMainMenu(tenant: BotTenantContext, to: string, leadId: string | null, intro?: string) {
  const body =
    intro ??
    `Welcome to ${tenant.tenantName}! 👋\n\nI can show you what's available right now, or connect you with our team.`;
  const result = await sendWhatsAppButtons({
    phoneNumberId: tenant.phoneNumberId,
    accessToken: tenant.accessToken,
    to,
    body,
    footer: "Powered by Realcorp",
    buttons: [
      { id: ID.listings, title: "🏠 Browse listings" },
      { id: ID.agent, title: "💬 Talk to an agent" },
    ],
  });
  await recordBotReply(tenant, to, body, result.ok ? result.messageId : null, leadId);
  return result;
}

async function sendListingsMenu(tenant: BotTenantContext, to: string, leadId: string | null) {
  const data = await loadPublicListings(tenant.tenantSlug, { limit: 10 });
  const listings = data?.listings ?? [];

  if (listings.length === 0) {
    const body = `We don't have published listings right now — but our team can tell you what's coming. Tap below to get a call back.`;
    const result = await sendWhatsAppButtons({
      phoneNumberId: tenant.phoneNumberId,
      accessToken: tenant.accessToken,
      to,
      body,
      buttons: [{ id: ID.agent, title: "💬 Talk to an agent" }],
    });
    await recordBotReply(tenant, to, body, result.ok ? result.messageId : null, leadId);
    return;
  }

  const body = `Here's what's available from ${tenant.tenantName}. Tap to see details and prices.`;
  const result = await sendWhatsAppList({
    phoneNumberId: tenant.phoneNumberId,
    accessToken: tenant.accessToken,
    to,
    header: "Available listings",
    body,
    footer: "Prices update in real time",
    buttonText: "View listings",
    rows: listings.map((l) => ({
      id: ID.listing(l.id),
      title: l.name,
      description: listingRowDescription(l),
    })),
  });
  await recordBotReply(tenant, to, body, result.ok ? result.messageId : null, leadId);
}

async function sendListingDetail(
  tenant: BotTenantContext,
  to: string,
  leadId: string | null,
  projectId: string,
) {
  const data = await loadPublicListings(tenant.tenantSlug, { limit: 50 });
  const listing = data?.listings.find((l) => l.id === projectId);

  if (!listing) {
    const body = "That listing is no longer available. Here's the current list:";
    const result = await sendWhatsAppText({
      phoneNumberId: tenant.phoneNumberId,
      accessToken: tenant.accessToken,
      to,
      body,
    });
    await recordBotReply(tenant, to, body, result.ok ? result.messageId : null, leadId);
    await sendListingsMenu(tenant, to, leadId);
    return;
  }

  const location = [listing.address, listing.city, listing.state].filter(Boolean).join(", ");
  const lines = [
    `*${listing.name}*`,
    location ? `📍 ${location}` : null,
    `💰 ${listingPriceLabel(listing)}`,
    listing.unitsAvailable > 0 ? `✅ ${listing.unitsAvailable} unit(s) available` : null,
    listing.description ? `\n${listing.description}` : null,
    listing.amenities.length ? `\n✨ ${listing.amenities.join(" · ")}` : null,
  ].filter(Boolean);
  const caption = lines.join("\n");

  if (listing.coverImageUrl) {
    const imageResult = await sendWhatsAppImage({
      phoneNumberId: tenant.phoneNumberId,
      accessToken: tenant.accessToken,
      to,
      imageUrl: listing.coverImageUrl,
      caption,
    });
    await recordBotReply(tenant, to, caption, imageResult.ok ? imageResult.messageId : null, leadId);
  } else {
    const textResult = await sendWhatsAppText({
      phoneNumberId: tenant.phoneNumberId,
      accessToken: tenant.accessToken,
      to,
      body: caption,
    });
    await recordBotReply(tenant, to, caption, textResult.ok ? textResult.messageId : null, leadId);
  }

  const followUp = "What would you like to do next?";
  const buttonsResult = await sendWhatsAppButtons({
    phoneNumberId: tenant.phoneNumberId,
    accessToken: tenant.accessToken,
    to,
    body: followUp,
    buttons: [
      { id: ID.book(listing.id), title: "📅 Book a viewing" },
      { id: ID.agent, title: "💬 Talk to an agent" },
      { id: ID.listings, title: "⬅️ More listings" },
    ],
  });
  await recordBotReply(tenant, to, followUp, buttonsResult.ok ? buttonsResult.messageId : null, leadId);
}

async function handleBookViewing(tenant: BotTenantContext, message: BotInboundMessage, projectId: string) {
  const lead = await ensureLead(tenant, message.from, message.profileName);

  const data = await loadPublicListings(tenant.tenantSlug, { limit: 50 });
  const listing = data?.listings.find((l) => l.id === projectId);
  const projectName = listing?.name ?? "a listing";

  if (listing) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { projectInterest: listing.name, lastActivityAt: new Date() },
    });
  }

  await createBotTask(
    tenant,
    lead.id,
    `WhatsApp viewing request — ${projectName}`,
    `Prospect on WhatsApp (${message.from}) asked to book a viewing for ${projectName} via the Realcorp Bot. Contact them to confirm a time.`,
  );

  const body = `Great choice! 🎉 Our team will contact you on this number shortly to confirm a date and time for your viewing of *${projectName}*.`;
  const result = await sendWhatsAppText({
    phoneNumberId: tenant.phoneNumberId,
    accessToken: tenant.accessToken,
    to: message.from,
    body,
  });
  await recordBotReply(tenant, message.from, body, result.ok ? result.messageId : null, lead.id);
}

async function handleTalkToAgent(tenant: BotTenantContext, message: BotInboundMessage) {
  const lead = await ensureLead(tenant, message.from, message.profileName);

  await createBotTask(
    tenant,
    lead.id,
    "WhatsApp agent request",
    `Prospect on WhatsApp (${message.from}) asked to speak with an agent via the Realcorp Bot. Reply on WhatsApp or call them.`,
  );

  const body = `You're in the queue! 🙌 One of our agents will message or call you on this number shortly.`;
  const result = await sendWhatsAppText({
    phoneNumberId: tenant.phoneNumberId,
    accessToken: tenant.accessToken,
    to: message.from,
    body,
  });
  await recordBotReply(tenant, message.from, body, result.ok ? result.messageId : null, lead.id);
}

async function findLeadIdForPhone(tenant: BotTenantContext, phone: string): Promise<string | null> {
  const variants = phoneVariants(phone);
  const lead = await prisma.lead.findFirst({
    where: { tenantId: tenant.tenantId, phone: { in: variants.length ? variants : [phone] } },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  return lead?.id ?? null;
}

/**
 * Entry point: route one inbound message through the bot.
 * Never throws — bot failures must not break webhook processing.
 */
export async function handleBotMessage(
  tenant: BotTenantContext,
  message: BotInboundMessage,
  intelligence: BotIntelligence = defaultIntelligence,
): Promise<void> {
  try {
    const leadId = await findLeadIdForPhone(tenant, message.from);

    // 1. Interactive replies carry intent in the id
    const replyId = message.interactiveReplyId;
    if (replyId?.startsWith("bot:")) {
      if (replyId === ID.menu) return void (await sendMainMenu(tenant, message.from, leadId));
      if (replyId === ID.listings) return void (await sendListingsMenu(tenant, message.from, leadId));
      if (replyId === ID.agent) return void (await handleTalkToAgent(tenant, message));
      if (replyId.startsWith("bot:listing:")) {
        return void (await sendListingDetail(
          tenant,
          message.from,
          leadId,
          replyId.slice("bot:listing:".length),
        ));
      }
      if (replyId.startsWith("bot:book:")) {
        return void (await handleBookViewing(tenant, message, replyId.slice("bot:book:".length)));
      }
      return void (await sendMainMenu(tenant, message.from, leadId));
    }

    // 2. Free text — simple intent matching first
    const text = message.text?.trim() ?? "";
    if (!text) return;

    if (GREETING_RE.test(text)) return void (await sendMainMenu(tenant, message.from, leadId));
    if (LISTINGS_RE.test(text)) return void (await sendListingsMenu(tenant, message.from, leadId));
    if (AGENT_RE.test(text)) return void (await handleTalkToAgent(tenant, message));

    // 3. AI seam — an LLM handler can answer free-form questions here
    const data = await loadPublicListings(tenant.tenantSlug, { limit: 10 });
    const aiReply = await intelligence.handleFreeText({
      tenant,
      message,
      listings: data?.listings ?? [],
    });
    if (aiReply) {
      const result = await sendWhatsAppText({
        phoneNumberId: tenant.phoneNumberId,
        accessToken: tenant.accessToken,
        to: message.from,
        body: aiReply,
      });
      await recordBotReply(tenant, message.from, aiReply, result.ok ? result.messageId : null, leadId);
      return;
    }

    // 4. Fallback: didn't understand — show the menu
    await sendMainMenu(
      tenant,
      message.from,
      leadId,
      `Thanks for your message! I'm ${tenant.tenantName}'s assistant. I can show you available listings or connect you with our team — an agent will also see your message shortly.`,
    );
  } catch (error) {
    console.error("[whatsapp-bot] failed to handle message", error);
  }
}
