type WhatsAppSendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

export async function sendWhatsAppText(params: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  body: string;
}): Promise<WhatsAppSendResult> {
  const { phoneNumberId, accessToken, to, body } = params;
  try {
    const resp = await fetch(
      `https://graph.facebook.com/v20.0/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { preview_url: false, body },
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
