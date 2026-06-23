import { Resend } from "resend";
import { formatBankAccountsForHtml, parseBankAccounts } from "@/lib/finance-bank-accounts";

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

export function getInviteBaseUrl() {
  return getBaseUrl();
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
  const subject = `Receipt ${input.receiptNumber} from ${input.tenantName}`;

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#111;max-width:560px">
      <h2 style="margin:0 0 8px;font-size:18px">${input.tenantName}</h2>
      <p style="margin:0 0 16px;color:#555">Payment receipt <strong>${input.receiptNumber}</strong></p>
      <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;background:#f9fafb;margin-bottom:16px">
        <p style="margin:0 0 4px;font-size:13px;color:#666">${input.title}</p>
        ${input.customerName ? `<p style="margin:0 0 8px;font-size:14px">Customer: <strong>${input.customerName}</strong></p>` : ""}
        <p style="margin:0;font-size:22px;font-weight:700;color:#111">${input.amountLabel}</p>
      </div>
      <p style="margin:0 0 12px;font-size:14px">Your receipt PDF is attached. You can also view it online:</p>
      <p style="margin:0 0 16px">
        <a href="${input.viewUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 14px;border-radius:8px;font-weight:600">
          View receipt
        </a>
      </p>
      <p style="margin:0;font-size:12px;color:#888">Please keep this receipt for your records.</p>
    </div>
  `;

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

function paymentBlockHtml(input: {
  bankAccountLines: string[];
  customPaymentInstructions?: string | null;
}) {
  const banks = parseBankAccounts(input.bankAccountLines);
  if (banks.length > 0) {
    return `<div style="margin-top:12px"><p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#333">Pay into:</p>${formatBankAccountsForHtml(banks)}</div>`;
  }
  if (input.customPaymentInstructions?.trim()) {
    return `<div style="margin-top:12px;padding:12px;border-radius:8px;background:#fff7ed;border:1px solid #fed7aa"><p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#333">Payment instructions</p><p style="margin:0;font-size:14px;color:#444">${input.customPaymentInstructions.trim()}</p></div>`;
  }
  return `<p style="margin:12px 0 0;font-size:13px;color:#666">Contact us for payment details.</p>`;
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
  const subject = input.isReminder
    ? `Payment reminder: ${input.invoiceNumber} — ${input.tenantName}`
    : `Invoice ${input.invoiceNumber} from ${input.tenantName}`;

  const intro = input.isReminder
    ? `<p style="margin:0 0 12px;font-size:14px;color:#444">This is a friendly reminder that the following invoice is outstanding.</p>`
    : `<p style="margin:0 0 12px;font-size:14px;color:#444">Please find your invoice attached.</p>`;

  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5;color:#111;max-width:560px">
      <h2 style="margin:0 0 8px;font-size:18px">${input.tenantName}</h2>
      <p style="margin:0 0 4px;color:#555">${input.isReminder ? "Payment reminder" : "Invoice"} <strong>${input.invoiceNumber}</strong></p>
      ${intro}
      <div style="border:1px solid #e5e7eb;border-radius:12px;padding:16px;background:#f9fafb;margin-bottom:8px">
        <p style="margin:0 0 4px;font-size:13px;color:#666">${input.title}</p>
        ${input.customerName ? `<p style="margin:0 0 8px;font-size:14px">Bill to: <strong>${input.customerName}</strong></p>` : ""}
        <p style="margin:0 0 4px;font-size:14px">Total: <strong>${input.amountLabel}</strong></p>
        <p style="margin:0 0 4px;font-size:14px">Balance due: <strong style="font-size:18px">${input.balanceLabel}</strong></p>
        <p style="margin:0;font-size:13px;color:#666">Due: ${input.dueDateLabel}</p>
      </div>
      ${paymentBlockHtml(input)}
      <p style="margin:16px 0 0;font-size:13px;color:#555">The PDF is attached for your records.</p>
    </div>
  `;

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
