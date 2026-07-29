import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatBankAccountsForPdf, type ParsedBankAccount } from "@/lib/finance-bank-accounts";
import {
  drawFinanceDocumentHeader,
  drawFinanceFooter,
  drawFinanceMetaGrid,
  wrapText,
  type FinancePdfBrand,
} from "@/lib/finance-document-pdf-layout";

export type InvoicePdfInput = {
  brand: FinancePdfBrand;
  invoiceNumber: string;
  title: string;
  customerName?: string | null;
  amount: number;
  balanceDue: number;
  currency: string;
  dueDate?: Date | null;
  issuedAt: Date;
  department?: string | null;
  bankAccounts: ParsedBankAccount[];
  customPaymentInstructions?: string | null;
  isReminder?: boolean;
};

function money(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function buildInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const { width } = page.getSize();
  const margin = 48;
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = await drawFinanceDocumentHeader({
    doc,
    page,
    brand: input.brand,
    documentLabel: input.isReminder ? "Payment reminder" : "Invoice",
    documentNumber: input.invoiceNumber,
    margin,
  });

  y = await drawFinanceMetaGrid({
    page,
    font,
    fontBold,
    margin,
    y,
    width,
    rows: [
      {
        label: "Issue date",
        value: new Intl.DateTimeFormat("en-NG", { dateStyle: "long" }).format(input.issuedAt),
      },
      {
        label: "Due date",
        value: input.dueDate
          ? new Intl.DateTimeFormat("en-NG", { dateStyle: "long" }).format(input.dueDate)
          : "On receipt",
      },
      { label: "From", value: input.brand.companyName },
      { label: "Bill to", value: input.customerName || "—" },
    ],
  });

  const tableTop = y;
  const cols = [
    { label: "ITEM", x: margin, w: 240 },
    { label: "QTY", x: margin + 250, w: 40 },
    { label: "UNIT PRICE", x: margin + 300, w: 90 },
    { label: "TOTAL", x: margin + 400, w: 100 },
  ];
  for (const col of cols) {
    page.drawText(col.label, {
      x: col.x,
      y: tableTop,
      size: 8,
      font: fontBold,
      color: rgb(0.45, 0.45, 0.45),
    });
  }
  y = tableTop - 16;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.82, 0.82, 0.82),
  });
  y -= 16;
  page.drawText(input.title.slice(0, 45), { x: margin, y, size: 10, font, color: rgb(0.12, 0.12, 0.12) });
  page.drawText("1", { x: margin + 250, y, size: 10, font, color: rgb(0.12, 0.12, 0.12) });
  page.drawText(money(input.currency, input.amount), {
    x: margin + 300,
    y,
    size: 10,
    font,
    color: rgb(0.12, 0.12, 0.12),
  });
  page.drawText(money(input.currency, input.amount), {
    x: margin + 400,
    y,
    size: 10,
    font,
    color: rgb(0.12, 0.12, 0.12),
  });
  y -= 28;

  const totalsX = width - margin - 160;
  page.drawText("Subtotal", { x: totalsX, y, size: 10, font, color: rgb(0.45, 0.45, 0.45) });
  page.drawText(money(input.currency, input.amount), {
    x: totalsX + 80,
    y,
    size: 10,
    font,
    color: rgb(0.12, 0.12, 0.12),
  });
  y -= 18;
  page.drawText("Balance due", { x: totalsX, y, size: 11, font: fontBold, color: rgb(0.12, 0.12, 0.12) });
  page.drawText(money(input.currency, input.balanceDue), {
    x: totalsX + 80,
    y,
    size: 11,
    font: fontBold,
    color: rgb(0.12, 0.12, 0.12),
  });
  y -= 28;

  if (input.department) {
    page.drawText("DEPARTMENT", { x: margin, y, size: 8, font: fontBold, color: rgb(0.45, 0.45, 0.45) });
    y -= 14;
    page.drawText(input.department, { x: margin, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
    y -= 20;
  }

  page.drawText("HOW TO PAY", { x: margin, y, size: 8, font: fontBold, color: rgb(0.45, 0.45, 0.45) });
  y -= 14;
  const bankLines = formatBankAccountsForPdf(input.bankAccounts);
  if (bankLines.length > 0) {
    for (const line of bankLines) {
      page.drawText(`• ${line}`, { x: margin + 4, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
      y -= 12;
    }
  } else if (input.customPaymentInstructions?.trim()) {
    for (const line of wrapText(input.customPaymentInstructions.trim(), 72)) {
      page.drawText(line, { x: margin, y, size: 9, font, color: rgb(0.2, 0.2, 0.2) });
      y -= 12;
    }
  } else {
    page.drawText("Contact us for payment instructions.", {
      x: margin,
      y,
      size: 9,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });
  }

  if (input.isReminder) {
    y -= 16;
    page.drawText("This is a friendly reminder that payment is outstanding.", {
      x: margin,
      y,
      size: 10,
      font: fontBold,
      color: rgb(0.75, 0.35, 0.1),
    });
  }

  drawFinanceFooter({ page, font, margin, width, note: "Thank you for your business." });

  return doc.save();
}

export function invoicePdfFileName(invoiceNumber: string) {
  return `${invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, "-")}.pdf`;
}
