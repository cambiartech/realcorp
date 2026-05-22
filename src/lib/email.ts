import { Resend } from "resend";

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

function getFromAddress() {
  return process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
}

function getFromName() {
  return process.env.RESEND_FROM_NAME || "Realcorp";
}

function getReplyToAddress() {
  return process.env.RESEND_FROM_REPLY_TO_EMAIL || process.env.RESEND_FROM_REPLY_TO || undefined;
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!apiKey.startsWith("re_")) return null;
  return new Resend(apiKey);
}

export async function sendInviteEmail(input: {
  to: string;
  tenantName: string;
  inviterLabel: string;
  inviteUrl: string;
  roleLabel: string;
}) {
  const resend = getResendClient();
  if (!resend) {
    return { ok: false as const, error: "RESEND_API_KEY is missing or invalid. Use your real key starting with re_." };
  }

  const from = `${getFromName()} <${getFromAddress()}>`;
  const replyTo = getReplyToAddress();
  const subject = `You are invited to join ${input.tenantName} on Realcorp`;

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#111">
      <h2 style="margin:0 0 12px;">Join ${input.tenantName} on Realcorp</h2>
      <p style="margin:0 0 12px;">${input.inviterLabel} invited you as <strong>${input.roleLabel}</strong>.</p>
      <p style="margin:0 0 16px;">
        <a href="${input.inviteUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:600;">
          Accept invite
        </a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#555;">Or copy this link into your browser:</p>
      <p style="margin:0 0 12px;font-size:13px;word-break:break-all;color:#333;">${input.inviteUrl}</p>
      <p style="margin:0;font-size:12px;color:#666;">This invite expires in 14 days.</p>
    </div>
  `;

  try {
    await resend.emails.send({
      from,
      to: input.to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    return { ok: true as const };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to send email.";
    return { ok: false as const, error: msg };
  }
}

export function getInviteBaseUrl() {
  return getBaseUrl();
}
