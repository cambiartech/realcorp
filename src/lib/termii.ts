/**
 * Termii SMS utility — Nigerian market SMS delivery.
 * Docs: https://developers.termii.com/
 */

const TERMII_BASE = "https://api.ng.termii.com/api";

export type TermiiSendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

/**
 * Send a single SMS via Termii.
 *
 * @param to      Recipient number — international format preferred, e.g. +2348012345678
 * @param message Message body (max 160 chars per SMS, or concatenated for longer)
 * @param apiKey  Termii API key (from TenantSettings.termiiApiKey)
 * @param from    Sender ID (from TenantSettings.termiiSenderId, max 11 chars)
 */
export async function sendSms(
  to: string,
  message: string,
  apiKey: string,
  from: string = "Realcorp",
): Promise<TermiiSendResult> {
  try {
    const resp = await fetch(`${TERMII_BASE}/sms/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to,
        from,
        sms: message,
        type: "plain",
        api_key: apiKey,
        channel: "generic",
      }),
    });

    const data = (await resp.json()) as {
      message_id?: string;
      message?: string;
      code?: string;
    };

    if (!resp.ok || data.code === "failed") {
      return { ok: false, error: data.message ?? `Termii error ${resp.status}` };
    }

    return { ok: true, messageId: data.message_id ?? "" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown SMS error" };
  }
}

/**
 * Verify a phone number via Termii Token (OTP).
 * Returns the token that was sent so you can compare it.
 */
export async function sendOtp(
  to: string,
  apiKey: string,
  from: string = "Realcorp",
  pinLength: number = 6,
): Promise<TermiiSendResult & { pin_id?: string }> {
  try {
    const resp = await fetch(`${TERMII_BASE}/sms/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        message_type: "NUMERIC",
        to,
        from,
        channel: "generic",
        pin_attempts: 3,
        pin_time_to_live: 10,
        pin_length: pinLength,
        pin_placeholder: "< 1234 >",
        message_text: "Your verification code is < 1234 >. Valid for 10 minutes.",
      }),
    });

    const data = (await resp.json()) as {
      pinId?: string;
      pin_id?: string;
      message?: string;
      code?: string;
    };

    if (!resp.ok || data.code === "failed") {
      return { ok: false, error: data.message ?? `Termii error ${resp.status}` };
    }

    return { ok: true, messageId: data.pinId ?? data.pin_id ?? "", pin_id: data.pin_id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown SMS error" };
  }
}
