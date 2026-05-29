import { sendWhatsAppText } from "@/lib/whatsapp";
import prisma from "@/lib/db";

const DEFAULT_AUTO_MESSAGE =
  "Hi {name}, thanks for your interest in {form_title}! A member of our team will reach out shortly.";

export function renderCaptureFormWhatsAppMessage(
  template: string | null | undefined,
  vars: { name: string; formTitle: string; tenantName: string },
): string {
  const raw = template?.trim() || DEFAULT_AUTO_MESSAGE;
  return raw
    .replace(/\{name\}/gi, vars.name)
    .replace(/\{form_title\}/gi, vars.formTitle)
    .replace(/\{org_name\}/gi, vars.tenantName);
}

/** Normalize phone for WhatsApp Cloud API (digits only, Nigeria-friendly). */
export function normalizeWhatsAppPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  if (digits.length === 10) return `234${digits}`;
  return digits;
}

export async function sendCaptureFormAutoWhatsApp(params: {
  tenantId: string;
  leadId: string;
  phone: string;
  message: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId: params.tenantId },
    select: { whatsappAccessToken: true, whatsappPhoneNumberId: true },
  });
  if (!settings?.whatsappAccessToken || !settings.whatsappPhoneNumberId) {
    return { ok: false, error: "WhatsApp not configured" };
  }

  const to = normalizeWhatsAppPhone(params.phone);
  if (!to) return { ok: false, error: "Invalid phone" };

  const sent = await sendWhatsAppText({
    accessToken: settings.whatsappAccessToken,
    phoneNumberId: settings.whatsappPhoneNumberId,
    to,
    body: params.message,
  });
  if (!sent.ok) return { ok: false, error: sent.error };

  await prisma.whatsAppMessage.create({
    data: {
      tenantId: params.tenantId,
      leadId: params.leadId,
      direction: "OUTBOUND",
      body: params.message,
      fromPhone: settings.whatsappPhoneNumberId,
      toPhone: to,
      timestamp: new Date(),
    },
  });

  return { ok: true };
}
