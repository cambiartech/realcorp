import { Resend } from "resend";
import { BIRTHDAY_BALLOONS_PNG_BASE64 } from "@/lib/birthday-balloons-png";
import { RECEIVED_MARK_PNG_BASE64 } from "@/lib/received-mark-png";
import { TASK_MARK_PNG_BASE64 } from "@/lib/task-mark-png";
import { WELCOME_MURAL_PNG_BASE64 } from "@/lib/welcome-mural-png";
import {
  hrProfileUpdateEmailContent,
  inviteEmailContent,
  invoiceEmailContent,
  passwordResetEmailContent,
  salesReceiptEmailContent,
  taskAssignedEmailContent,
} from "@/lib/email-templates";

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

export function isTransactionalEmailConfigured() {
  return Boolean(getResendClient());
}

function swapMailArt(
  html: string,
  label: string,
  img: string,
  file: { filename: string; content: string; contentId: string },
) {
  if (!html.includes(`aria-label="${label}"`)) return { html, file: null as typeof file | null };
  return {
    html: html.replace(new RegExp(`<svg[\\s\\S]*?aria-label="${label}"[\\s\\S]*?<\\/svg>`), img),
    file,
  };
}

const MAIL_ART = [
  {
    label: "Balloons",
    img: '<img src="cid:birthday-balloons" width="240" alt="" style="display:block;margin:0 auto;border:0;background:transparent">',
    file: {
      filename: "birthday-balloons.png",
      content: BIRTHDAY_BALLOONS_PNG_BASE64,
      contentId: "birthday-balloons",
    },
  },
  {
    label: "Welcome",
    img: '<img src="cid:welcome-mural" width="520" alt="" style="display:block;width:100%;max-width:520px;border:0;background:transparent">',
    file: {
      filename: "welcome-mural.png",
      content: WELCOME_MURAL_PNG_BASE64,
      contentId: "welcome-mural",
    },
  },
  {
    label: "Received",
    img: '<img src="cid:received-mark" width="220" alt="" style="display:block;margin:0 auto;border:0;background:transparent">',
    file: {
      filename: "received-mark.png",
      content: RECEIVED_MARK_PNG_BASE64,
      contentId: "received-mark",
    },
  },
  {
    label: "Task",
    img: '<img src="cid:task-mark" width="120" alt="" style="display:block;margin:0 auto;border:0;background:transparent">',
    file: {
      filename: "task-mark.png",
      content: TASK_MARK_PNG_BASE64,
      contentId: "task-mark",
    },
  },
] as const;

function withMailArt(html: string) {
  const attachments: Array<{ filename: string; content: string; contentId: string }> = [];
  for (const art of MAIL_ART) {
    const swapped = swapMailArt(html, art.label, art.img, art.file);
    html = swapped.html;
    if (swapped.file) attachments.push(swapped.file);
  }
  return { html, attachments };
}

function parseResendSendResult(result: { data: unknown; error: unknown }) {
  if (result.error) {
    const err = result.error as { message?: string };
    return { ok: false as const, error: err.message || "Failed to send email." };
  }
  return { ok: true as const };
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
    return {
      ok: false as const,
      error: "RESEND_API_KEY is missing or invalid. Use your real key starting with re_.",
    };
  }

  const from = `${getFromName()} <${getFromAddress()}>`;
  const replyTo = getReplyToAddress();
  const { subject, html } = inviteEmailContent(input);
  const prepared = withMailArt(html);

  try {
    const result = await resend.emails.send({
      from,
      to: input.to,
      subject,
      html: prepared.html,
      ...(replyTo ? { replyTo } : {}),
      ...(prepared.attachments.length ? { attachments: prepared.attachments } : {}),
    });
    return parseResendSendResult(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to send email.";
    return { ok: false as const, error: msg };
  }
}

export function getInviteBaseUrl() {
  return getBaseUrl();
}

export async function sendPasswordResetEmail(input: { to: string; resetUrl: string; name?: string | null }) {
  const resend = getResendClient();
  if (!resend) {
    return {
      ok: false as const,
      error: "RESEND_API_KEY is missing or invalid. Use your real key starting with re_.",
    };
  }

  const from = `${getFromName()} <${getFromAddress()}>`;
  const replyTo = getReplyToAddress();
  const { subject, html } = passwordResetEmailContent(input);

  try {
    const result = await resend.emails.send({
      from,
      to: input.to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    return parseResendSendResult(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to send email.";
    return { ok: false as const, error: msg };
  }
}

export async function sendSalesReceiptEmail(input: {
  to: string;
  tenantName: string;
  receiptNumber: string;
  title: string;
  customerName?: string | null;
  amountLabel: string;
  pdfBytes: Uint8Array;
  pdfFileName: string;
  viewUrl: string;
}) {
  const resend = getResendClient();
  if (!resend) {
    return { ok: false as const, error: "Email is not configured (RESEND_API_KEY)." };
  }

  const from = `${getFromName()} <${getFromAddress()}>`;
  const replyTo = getReplyToAddress();
  const { subject, html } = salesReceiptEmailContent(input);
  const prepared = withMailArt(html);

  try {
    const result = await resend.emails.send({
      from,
      to: input.to,
      subject,
      html: prepared.html,
      ...(replyTo ? { replyTo } : {}),
      attachments: [
        ...prepared.attachments,
        {
          filename: input.pdfFileName,
          content: Buffer.from(input.pdfBytes).toString("base64"),
        },
      ],
    });
    return parseResendSendResult(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to send email.";
    return { ok: false as const, error: msg };
  }
}

export async function sendInvoiceEmail(input: {
  to: string;
  tenantName: string;
  invoiceNumber: string;
  title: string;
  customerName?: string | null;
  amountLabel: string;
  balanceLabel: string;
  dueDateLabel: string;
  bankAccountLines: string[];
  customPaymentInstructions?: string | null;
  pdfBytes: Uint8Array;
  pdfFileName: string;
  isReminder?: boolean;
}) {
  const resend = getResendClient();
  if (!resend) {
    return { ok: false as const, error: "Email is not configured (RESEND_API_KEY)." };
  }

  const from = `${getFromName()} <${getFromAddress()}>`;
  const replyTo = getReplyToAddress();
  const { subject, html } = invoiceEmailContent(input);

  try {
    const result = await resend.emails.send({
      from,
      to: input.to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
      attachments: [
        {
          filename: input.pdfFileName,
          content: Buffer.from(input.pdfBytes).toString("base64"),
        },
      ],
    });
    return parseResendSendResult(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to send email.";
    return { ok: false as const, error: msg };
  }
}

export async function sendHrProfileUpdateEmail(input: {
  to: string;
  tenantName: string;
  employeeName: string;
  changeLines: string[];
  reviewUrl: string;
}) {
  const resend = getResendClient();
  if (!resend) {
    return { ok: false as const, error: "Email is not configured (RESEND_API_KEY)." };
  }
  const from = `${getFromName()} <${getFromAddress()}>`;
  const replyTo = getReplyToAddress();
  const { subject, html } = hrProfileUpdateEmailContent(input);
  try {
    const result = await resend.emails.send({
      from,
      to: input.to,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    return parseResendSendResult(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to send email.";
    return { ok: false as const, error: msg };
  }
}

export async function sendTaskAssignedEmail(input: {
  to: string;
  tenantName: string;
  assigneeName: string;
  assignerLabel: string;
  taskTitle: string;
  taskDescription?: string | null;
  dueDateLabel?: string | null;
  priority?: string | null;
  taskUrl: string;
}) {
  const resend = getResendClient();
  if (!resend) {
    return { ok: false as const, error: "Email is not configured (RESEND_API_KEY)." };
  }
  const from = `${getFromName()} <${getFromAddress()}>`;
  const replyTo = getReplyToAddress();
  const { subject, html } = taskAssignedEmailContent(input);
  const prepared = withMailArt(html);
  try {
    const result = await resend.emails.send({
      from,
      to: input.to,
      subject,
      html: prepared.html,
      ...(replyTo ? { replyTo } : {}),
      ...(prepared.attachments.length ? { attachments: prepared.attachments } : {}),
    });
    return parseResendSendResult(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to send email.";
    return { ok: false as const, error: msg };
  }
}

export async function sendCelebrationEmail(input: {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
}) {
  const resend = getResendClient();
  if (!resend) {
    return { ok: false as const, error: "Email is not configured (RESEND_API_KEY)." };
  }
  const from = `${input.fromName || getFromName()} <${getFromAddress()}>`;
  const replyTo = getReplyToAddress();
  const prepared = withMailArt(input.html);
  try {
    const result = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: prepared.html,
      ...(replyTo ? { replyTo } : {}),
      ...(prepared.attachments.length ? { attachments: prepared.attachments } : {}),
    });
    return parseResendSendResult(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to send email.";
    return { ok: false as const, error: msg };
  }
}
