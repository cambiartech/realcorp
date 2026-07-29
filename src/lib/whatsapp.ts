/** Meta WhatsApp Cloud API helpers. Docs: https://developers.facebook.com/docs/whatsapp/cloud-api */

const WHATSAPP_API_VERSION = "v23.0";

type WhatsAppSendResult = { ok: true; messageId: string } | { ok: false; error: string };

/**
 * Normalize any stored phone format into the E.164-style digits the Cloud API
 * expects (no plus, no spaces). Nigeria-friendly: 080… and bare 10-digit
 * numbers get the 234 country code.
 */
export function toWhatsAppPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0") && digits.length === 11) return `234${digits.slice(1)}`;
  if (digits.length === 10) return `234${digits}`;
  return digits;
}

type WhatsAppCredentials = {
  phoneNumberId: string;
  accessToken: string;
};

/** POST any message payload to the Cloud API messages endpoint. */
async function postWhatsAppMessage(
  creds: WhatsAppCredentials,
  payload: Record<string, unknown>,
): Promise<WhatsAppSendResult> {
  try {
    const resp = await fetch(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${encodeURIComponent(creds.phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          ...payload,
        }),
      },
    );

    const data = (await resp.json()) as {
      messages?: Array<{ id: string }>;
      error?: { message?: string };
    };
    if (!resp.ok || !data.messages?.[0]?.id) {
      return { ok: false, error: data.error?.message ?? `WhatsApp API error (${resp.status})` };
    }
    return { ok: true, messageId: data.messages[0].id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown WhatsApp error" };
  }
}

export async function sendWhatsAppText(params: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  body: string;
}): Promise<WhatsAppSendResult> {
  const { to, body, ...creds } = params;
  return postWhatsAppMessage(creds, {
    to,
    type: "text",
    text: { preview_url: false, body },
  });
}

/** Interactive list: a menu of up to 10 tappable rows. The chosen row id arrives via webhook. */
export async function sendWhatsAppList(params: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  header?: string;
  body: string;
  footer?: string;
  buttonText: string;
  rows: Array<{ id: string; title: string; description?: string }>;
}): Promise<WhatsAppSendResult> {
  const { to, header, body, footer, buttonText, rows, ...creds } = params;
  return postWhatsAppMessage(creds, {
    to,
    type: "interactive",
    interactive: {
      type: "list",
      ...(header ? { header: { type: "text", text: header.slice(0, 60) } } : {}),
      body: { text: body.slice(0, 1024) },
      ...(footer ? { footer: { text: footer.slice(0, 60) } } : {}),
      action: {
        button: buttonText.slice(0, 20),
        sections: [
          {
            rows: rows.slice(0, 10).map((row) => ({
              id: row.id.slice(0, 200),
              title: row.title.slice(0, 24),
              ...(row.description ? { description: row.description.slice(0, 72) } : {}),
            })),
          },
        ],
      },
    },
  });
}

/** Reply buttons: up to 3 quick-tap options. The chosen button id arrives via webhook. */
export async function sendWhatsAppButtons(params: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  body: string;
  footer?: string;
  buttons: Array<{ id: string; title: string }>;
}): Promise<WhatsAppSendResult> {
  const { to, body, footer, buttons, ...creds } = params;
  return postWhatsAppMessage(creds, {
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body.slice(0, 1024) },
      ...(footer ? { footer: { text: footer.slice(0, 60) } } : {}),
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: "reply",
          reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) },
        })),
      },
    },
  });
}

/** Image message with optional caption (used for listing cards). */
export async function sendWhatsAppImage(params: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  imageUrl: string;
  caption?: string;
}): Promise<WhatsAppSendResult> {
  const { to, imageUrl, caption, ...creds } = params;
  return postWhatsAppMessage(creds, {
    to,
    type: "image",
    image: { link: imageUrl, ...(caption ? { caption: caption.slice(0, 1024) } : {}) },
  });
}
