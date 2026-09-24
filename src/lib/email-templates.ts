import { parseBankAccounts } from "@/lib/finance-bank-accounts";
import {
  escapeHtml,
  mailButton,
  mailCard,
  mailDocument,
  mailLinkFallback,
  mailNote,
  mailParagraph,
  MAIL_SANS,
  MAIL_SERIF,
} from "@/lib/mail-layout";

function moneyRow(label: string, value: string, emphasize = false) {
  return `<tr>
    <td style="padding:10px 0;border-top:1px solid rgba(22,21,15,0.08);font-family:${MAIL_SANS};font-size:13px;color:#6b6862">${escapeHtml(label)}</td>
    <td align="right" style="padding:10px 0;border-top:1px solid rgba(22,21,15,0.08);font-family:${emphasize ? MAIL_SERIF : MAIL_SANS};font-size:${emphasize ? "22" : "15"}px;font-weight:${emphasize ? "500" : "600"};color:#16150f">${escapeHtml(value)}</td>
  </tr>`;
}

function detailTable(rows: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px">${rows}</table>`;
}

function paymentBlock(input: { bankAccountLines: string[]; customPaymentInstructions?: string | null }) {
  const banks = parseBankAccounts(input.bankAccountLines);
  if (banks.length > 0) {
    const items = banks
      .map(
        (account) =>
          `<p style="margin:12px 0 0;font-family:${MAIL_SANS};font-size:15px;line-height:1.5;color:#16150f"><strong>${escapeHtml(account.bankName)}</strong><br><span style="color:#3f3d38">${escapeHtml(account.accountNumber)}</span><br><span style="color:#6b6862">${escapeHtml(account.accountName)}</span></p>`,
      )
      .join("");
    return `${mailNote("Pay into")} ${items}`;
  }
  const custom = input.customPaymentInstructions?.trim();
  if (custom) {
    return `${mailNote("How to pay")}${mailParagraph(escapeHtml(custom))}`;
  }
  return mailNote("Reply to this email if you need payment details.");
}

/** Full-width welcome frieze: bunting, an open door, and a small bunch of balloons. */
const WELCOME_MURAL = `
<svg width="520" height="168" viewBox="0 0 520 168" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Welcome" style="display:block;width:100%;height:auto">
  <defs>
    <clipPath id="rc-welcome-mural">
      <path d="M16 0H504a16 16 0 0 1 16 16V168H0V16A16 16 0 0 1 16 0z"/>
    </clipPath>
  </defs>
  <g clip-path="url(#rc-welcome-mural)">
  <circle cx="86" cy="108" r="42" fill="#a8663c"/>
  <circle cx="72" cy="94" r="12" fill="#ffffff" opacity="0.2"/>
  <path d="M0 28 H520" stroke="#c9c2b6" stroke-width="1.25"/>
  <path d="M18 28h22l-11 20z" fill="#a8663c"/>
  <path d="M58 28h22l-11 20z" fill="#16150f" stroke="#efe8df" stroke-width="1"/>
  <path d="M98 28h22l-11 20z" fill="#c4a484"/>
  <path d="M138 28h22l-11 20z" fill="#a8663c"/>
  <path d="M178 28h22l-11 20z" fill="#e6d3bc"/>
  <path d="M218 28h22l-11 20z" fill="#16150f" stroke="#efe8df" stroke-width="1"/>
  <path d="M258 28h22l-11 20z" fill="#c4a484"/>
  <path d="M298 28h22l-11 20z" fill="#a8663c"/>
  <path d="M338 28h22l-11 20z" fill="#16150f" stroke="#efe8df" stroke-width="1"/>
  <path d="M378 28h22l-11 20z" fill="#e6d3bc"/>
  <path d="M418 28h22l-11 20z" fill="#c4a484"/>
  <path d="M458 28h22l-11 20z" fill="#a8663c"/>
  <path d="M498 28h22l-11 20z" fill="#16150f" stroke="#efe8df" stroke-width="1"/>
  <path d="M196 156 V92 C196 48 324 48 324 92 V156 Z" fill="none" stroke="#a8663c" stroke-width="2.6"/>
  <path d="M262 156 V104 C262 86 310 86 310 104 V156 Z" fill="#a8663c"/>
  <circle cx="300" cy="128" r="2.4" fill="#16150f"/>
  <rect x="176" y="152" width="168" height="7" rx="2" fill="#a8663c"/>
  <g transform="translate(348 62) scale(0.72)">
    <g fill="none" stroke="#c9c2b6" stroke-width="1.4" stroke-linecap="round">
      <path d="M28 62c4 8 18 16 36 20"/>
      <path d="M64 68v16"/>
      <path d="M100 62c-4 8-18 16-36 20"/>
    </g>
    <g transform="translate(0 8) rotate(-14 22 28)">
      <path fill="#c4a484" d="M22 2C10 3 2 18 5 36c2 12 9 18 17 24 8-6 16-12 19-24C46 16 34 0 22 2z"/>
      <ellipse fill="#ffffff" opacity="0.34" cx="13" cy="16" rx="4" ry="7"/>
    </g>
    <g transform="translate(78 10) rotate(12 22 28)">
      <path fill="#16150f" stroke="#efe8df" stroke-width="1.6" d="M22 0C10 1 2 16 5 34c2 12 9 18 17 24 8-6 16-12 19-24C46 14 34-1 22 0z"/>
      <ellipse fill="#ffffff" opacity="0.16" cx="13" cy="14" rx="4" ry="6"/>
    </g>
    <g transform="translate(36 0)">
      <path fill="#a8663c" d="M24 0C10 1 0 20 4 40c3 14 11 20 20 28 8-8 18-14 21-28C50 18 38-1 24 0z"/>
      <ellipse fill="#ffffff" opacity="0.26" cx="14" cy="18" rx="5" ry="8"/>
    </g>
  </g>
  </g>
</svg>
`;

export function inviteEmailContent(input: {
  tenantName: string;
  inviterLabel: string;
  inviteUrl: string;
  roleLabel: string;
}) {
  const html = mailDocument(
    mailCard({
      eyebrow: input.tenantName,
      heading: "You're invited",
      headingSize: 36,
      ornament: WELCOME_MURAL,
      ornamentBleed: true,
      bodyHtml: [
        mailParagraph(
          `${escapeHtml(input.inviterLabel)} invited you to ${escapeHtml(input.tenantName)} as ${escapeHtml(input.roleLabel)}. We saved you a place.`,
          true,
        ),
        mailParagraph("The link is good for 14 days."),
        mailButton(input.inviteUrl, "Accept invite"),
        mailLinkFallback(input.inviteUrl),
      ].join(""),
    }),
  );
  return { subject: `You're invited to ${input.tenantName}`, html };
}

export function passwordResetEmailContent(input: { resetUrl: string; name?: string | null }) {
  const greeting = input.name?.trim() ? `Hi ${escapeHtml(input.name.trim())},` : "Hi,";
  const html = mailDocument(
    mailCard({
      eyebrow: "Realcorp",
      heading: "Reset your password",
      bodyHtml: [
        mailParagraph(greeting, true),
        mailParagraph(
          "Someone asked to reset the password for this email. The link expires in one hour. If you did not ask, ignore this and your password stays as it is.",
        ),
        mailButton(input.resetUrl, "Set a new password"),
        mailLinkFallback(input.resetUrl),
      ].join(""),
    }),
  );
  return { subject: "Reset your Realcorp password", html };
}

/** A seal under a short string of pennants. No plate behind it. */
const RECEIVED_MARK = `
<svg width="220" height="96" viewBox="0 0 220 96" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Received">
  <path d="M28 16 H192" stroke="#c9c2b6" stroke-width="1.2" fill="none"/>
  <path d="M40 16h16l-8 14z" fill="#a8663c"/>
  <path d="M66 16h16l-8 14z" fill="#16150f" stroke="#efe8df" stroke-width="0.8"/>
  <path d="M92 16h16l-8 14z" fill="#c4a484"/>
  <path d="M118 16h16l-8 14z" fill="#a8663c"/>
  <path d="M144 16h16l-8 14z" fill="#16150f" stroke="#efe8df" stroke-width="0.8"/>
  <path d="M170 16h16l-8 14z" fill="#c4a484"/>
  <circle cx="110" cy="66" r="22" fill="#a8663c"/>
  <circle cx="102" cy="58" r="6" fill="#ffffff" opacity="0.22"/>
  <path d="M99 66 l7 7 15-16" fill="none" stroke="#16150f" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

/** A note on a pin. The paper is the shape, not a backdrop. */
const TASK_MARK = `
<svg width="120" height="108" viewBox="0 0 120 108" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Task">
  <rect x="28" y="30" width="64" height="62" rx="8" fill="#f3eee6" stroke="#16150f" stroke-width="1.8"/>
  <path d="M42 50h36M42 62h26M42 74h18" stroke="#a8663c" stroke-width="2.2" stroke-linecap="round"/>
  <circle cx="60" cy="22" r="8" fill="#a8663c"/>
  <circle cx="60" cy="22" r="2.6" fill="#16150f"/>
</svg>
`;

export function salesReceiptEmailContent(input: {
  tenantName: string;
  receiptNumber: string;
  title: string;
  customerName?: string | null;
  amountLabel: string;
  viewUrl: string;
}) {
  const who = input.customerName?.trim();
  const html = mailDocument(
    mailCard({
      eyebrow: input.tenantName,
      heading: `Receipt ${input.receiptNumber}`,
      ornament: RECEIVED_MARK,
      bodyHtml: [
        mailParagraph(escapeHtml(input.title), true),
        who ? mailParagraph(`Received from ${escapeHtml(who)}.`) : "",
        detailTable(moneyRow("Amount", input.amountLabel, true)),
        mailButton(input.viewUrl, "View receipt"),
        mailNote("The PDF is attached. Keep it with your records."),
      ].join(""),
    }),
  );
  return { subject: `Receipt ${input.receiptNumber} from ${input.tenantName}`, html };
}

export function invoiceEmailContent(input: {
  tenantName: string;
  invoiceNumber: string;
  title: string;
  customerName?: string | null;
  amountLabel: string;
  balanceLabel: string;
  dueDateLabel: string;
  bankAccountLines: string[];
  customPaymentInstructions?: string | null;
  isReminder?: boolean;
}) {
  const who = input.customerName?.trim();
  const heading = input.isReminder ? `Reminder ${input.invoiceNumber}` : `Invoice ${input.invoiceNumber}`;
  const lead = input.isReminder
    ? "This invoice is still open."
    : "Your invoice is attached.";
  const html = mailDocument(
    mailCard({
      eyebrow: input.tenantName,
      heading,
      bodyHtml: [
        mailParagraph(lead, true),
        mailParagraph(escapeHtml(input.title)),
        who ? mailNote(`Bill to ${escapeHtml(who)}`) : "",
        detailTable(
          [
            moneyRow("Total", input.amountLabel),
            moneyRow("Balance due", input.balanceLabel, true),
            moneyRow("Due", input.dueDateLabel),
          ].join(""),
        ),
        paymentBlock(input),
        mailNote("The PDF is attached."),
      ].join(""),
    }),
  );
  const subject = input.isReminder
    ? `Payment reminder: ${input.invoiceNumber} — ${input.tenantName}`
    : `Invoice ${input.invoiceNumber} from ${input.tenantName}`;
  return { subject, html };
}

export function hrProfileUpdateEmailContent(input: {
  tenantName: string;
  employeeName: string;
  changeLines: string[];
  reviewUrl: string;
}) {
  const items = input.changeLines
    .map(
      (line) =>
        `<li style="margin:0 0 6px;font-family:${MAIL_SANS};font-size:15px;line-height:1.5;color:#3f3d38">${escapeHtml(line)}</li>`,
    )
    .join("");
  const html = mailDocument(
    mailCard({
      eyebrow: input.tenantName,
      heading: "Review a record update",
      bodyHtml: [
        mailParagraph(
          `${escapeHtml(input.employeeName)} updated personal details. Nothing changes until you approve it.`,
          true,
        ),
        `<ul style="margin:16px 0 0;padding-left:18px">${items}</ul>`,
        mailButton(input.reviewUrl, "Review in People"),
        mailNote("Pay and job title were not part of this request."),
      ].join(""),
    }),
  );
  return {
    subject: `${input.employeeName} updated their record — review needed`,
    html,
  };
}

export function taskAssignedEmailContent(input: {
  tenantName: string;
  assigneeName: string;
  assignerLabel: string;
  taskTitle: string;
  taskDescription?: string | null;
  dueDateLabel?: string | null;
  priority?: string | null;
  taskUrl: string;
}) {
  const description = input.taskDescription?.trim();
  const rows = [
    input.priority ? moneyRow("Priority", input.priority) : "",
    input.dueDateLabel ? moneyRow("Due", input.dueDateLabel) : "",
  ].join("");
  const html = mailDocument(
    mailCard({
      eyebrow: input.tenantName,
      heading: input.taskTitle,
      ornament: TASK_MARK,
      bodyHtml: [
        mailParagraph(
          `${escapeHtml(input.assignerLabel)} assigned this to ${escapeHtml(input.assigneeName)}.`,
          true,
        ),
        description
          ? `<p style="margin:14px 0 0;font-family:${MAIL_SANS};font-size:16px;line-height:1.6;color:#3f3d38;white-space:pre-wrap">${escapeHtml(description)}</p>`
          : "",
        rows ? detailTable(rows) : "",
        mailButton(input.taskUrl, "Open task"),
      ].join(""),
    }),
  );
  return { subject: `New task: ${input.taskTitle}`, html };
}
