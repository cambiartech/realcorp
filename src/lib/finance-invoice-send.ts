import "server-only";

import { InvoiceStatus } from "@/generated/prisma";
import { ClientDocumentCategory, FinanceDocumentCategory } from "@/generated/prisma";
import { sendInvoiceEmail } from "@/lib/email";
import { parseBankAccounts } from "@/lib/finance-bank-accounts";
import { normalizeFinanceOptionList } from "@/lib/finance-catalog";
import { buildInvoicePdf, invoicePdfFileName } from "@/lib/invoice-pdf";
import { uploadBufferToCloudinary } from "@/lib/cloudinary-upload-server";
import prisma from "@/lib/db";
import { financePdfBrandFromSettings } from "@/lib/tenant-branding";

export type DeliverInvoiceEmailInput = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  invoiceId: string;
  toEmail: string;
  actorUserId: string;
  actorLabel: string;
  mode: "send" | "remind" | "resend";
  customPaymentInstructions?: string;
};

export async function deliverInvoiceEmail(
  input: DeliverInvoiceEmailInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const invoice = await prisma.invoice.findFirst({
    where: { id: input.invoiceId, tenantId: input.tenantId },
    include: {
      deal: {
        select: {
          propertyClient: { select: { id: true, fullName: true, email: true } },
          lead: { select: { name: true, email: true } },
        },
      },
    },
  });
  if (!invoice) return { ok: false, error: "Invoice not found." };
  if (invoice.status === InvoiceStatus.VOID) return { ok: false, error: "Cannot email a void invoice." };
  if (invoice.status === InvoiceStatus.PAID) return { ok: false, error: "Invoice is already fully paid." };
  if (Number(invoice.balanceDue) <= 0) return { ok: false, error: "Invoice has no outstanding balance." };

  if (input.mode === "send" && invoice.status !== InvoiceStatus.DRAFT) {
    return { ok: false, error: "Only draft invoices can be sent for the first time. Use Resend instead." };
  }
  if (input.mode === "remind" && invoice.status === InvoiceStatus.DRAFT) {
    return { ok: false, error: "Send the invoice before reminders." };
  }
  if (input.mode === "resend" && invoice.status === InvoiceStatus.DRAFT) {
    return { ok: false, error: "Send the invoice first." };
  }

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId: input.tenantId },
    select: {
      financeBankAccounts: true,
      logoUrl: true,
      orgEmail: true,
      orgPhone: true,
      orgAddressLine: true,
      orgCity: true,
      orgState: true,
      orgCountry: true,
    },
  });
  const bankAccountLines = normalizeFinanceOptionList(settings?.financeBankAccounts);
  const bankAccounts = parseBankAccounts(bankAccountLines);

  const customerName =
    invoice.deal?.propertyClient?.fullName || invoice.deal?.lead?.name || null;

  const pdfBytes = await buildInvoicePdf({
    brand: financePdfBrandFromSettings(input.tenantName, settings),
    invoiceNumber: invoice.invoiceNumber,
    title: invoice.title,
    customerName,
    amount: Number(invoice.amount),
    balanceDue: Number(invoice.balanceDue),
    currency: invoice.currency,
    dueDate: invoice.dueDate,
    issuedAt: invoice.issuedAt,
    department: invoice.department,
    bankAccounts,
    customPaymentInstructions: input.customPaymentInstructions,
    isReminder: input.mode === "remind",
  });

  const pdfFileName = invoicePdfFileName(invoice.invoiceNumber);
  const uploaded = await uploadBufferToCloudinary({
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug,
    area: "finance",
    buffer: pdfBytes,
    fileName: pdfFileName,
    resourceType: "raw",
  });
  if (!uploaded.ok) return { ok: false, error: uploaded.error };

  const amountLabel = `${invoice.currency} ${Number(invoice.amount).toLocaleString("en-NG")}`;
  const balanceLabel = `${invoice.currency} ${Number(invoice.balanceDue).toLocaleString("en-NG")}`;
  const dueDateLabel = invoice.dueDate
    ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(invoice.dueDate)
    : "On receipt";

  const emailed = await sendInvoiceEmail({
    to: input.toEmail,
    tenantName: input.tenantName,
    invoiceNumber: invoice.invoiceNumber,
    title: invoice.title,
    customerName,
    amountLabel,
    balanceLabel,
    dueDateLabel,
    bankAccountLines,
    customPaymentInstructions: input.customPaymentInstructions,
    pdfBytes,
    pdfFileName,
    isReminder: input.mode === "remind",
  });
  if (!emailed.ok) return { ok: false, error: emailed.error };

  const docTitle = `${invoice.invoiceNumber} — ${invoice.title}`;
  const auditAction = input.mode === "remind" ? "SEND_REMINDER" : "SEND";
  const auditSummary =
    input.mode === "remind"
      ? `Sent payment reminder for ${invoice.invoiceNumber} to ${input.toEmail}.`
      : input.mode === "resend"
        ? `Resent invoice ${invoice.invoiceNumber} to ${input.toEmail}.`
        : `Sent invoice ${invoice.invoiceNumber} to ${input.toEmail}.`;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          ...(input.mode === "send" ? { status: InvoiceStatus.SENT } : {}),
          pdfUrl: uploaded.secureUrl,
          sentAt: new Date(),
          sentToEmail: input.toEmail,
        },
      });

      await tx.financeDocument.upsert({
        where: { invoiceId: invoice.id },
        create: {
          tenantId: input.tenantId,
          category: FinanceDocumentCategory.INVOICE,
          title: docTitle,
          fileUrl: uploaded.secureUrl,
          fileName: pdfFileName,
          invoiceId: invoice.id,
          uploadedByUserId: input.actorUserId,
          uploadedByLabel: input.actorLabel,
        },
        update: {
          title: docTitle,
          fileUrl: uploaded.secureUrl,
          fileName: pdfFileName,
          uploadedByUserId: input.actorUserId,
          uploadedByLabel: input.actorLabel,
        },
      });

      const clientId = invoice.deal?.propertyClient?.id;
      if (clientId) {
        const existingClientDoc = await tx.clientDocument.findFirst({
          where: {
            tenantId: input.tenantId,
            clientId,
            title: docTitle,
            category: ClientDocumentCategory.CORRESPONDENCE,
          },
          select: { id: true },
        });
        if (!existingClientDoc) {
          await tx.clientDocument.create({
            data: {
              tenantId: input.tenantId,
              clientId,
              category: ClientDocumentCategory.CORRESPONDENCE,
              title: docTitle,
              fileUrl: uploaded.secureUrl,
              fileName: pdfFileName,
              uploadedByUserId: input.actorUserId,
              uploadedByLabel: input.actorLabel,
            },
          });
        } else {
          await tx.clientDocument.update({
            where: { id: existingClientDoc.id },
            data: {
              fileUrl: uploaded.secureUrl,
              fileName: pdfFileName,
              uploadedByUserId: input.actorUserId,
              uploadedByLabel: input.actorLabel,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          tenantId: input.tenantId,
          actorUserId: input.actorUserId,
          actorLabel: input.actorLabel,
          module: "FINANCE",
          entityType: "INVOICE",
          entityId: invoice.id,
          action: auditAction,
          summary: auditSummary,
          metadata: {
            toEmail: input.toEmail,
            balanceDue: Number(invoice.balanceDue),
            dueDate: invoice.dueDate?.toISOString() || null,
            mode: input.mode,
          },
        },
      });
    });
  } catch {
    return { ok: false, error: "Could not record invoice send." };
  }

  return { ok: true };
}

export function resolveInvoiceRecipientEmail(invoice: {
  deal?: {
    propertyClient?: { email: string | null } | null;
    lead?: { email: string | null } | null;
  } | null;
}): string {
  return (
    invoice.deal?.propertyClient?.email?.trim() ||
    invoice.deal?.lead?.email?.trim() ||
    ""
  );
}
