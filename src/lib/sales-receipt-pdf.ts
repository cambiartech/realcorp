import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  drawFinanceAmountBox,
  drawFinanceDocumentHeader,
  drawFinanceFooter,
  drawFinanceKeyValueRows,
  drawFinanceMetaGrid,
  wrapText,
  type FinancePdfBrand,
} from "@/lib/finance-document-pdf-layout";

export type SalesReceiptPdfInput = {
  brand: FinancePdfBrand;
  receiptNumber: string;
  title: string;
  customerName?: string | null;
  amount: number;
  currency: string;
  paymentMode?: string | null;
  depositAccount?: string | null;
  reference?: string | null;
  note?: string | null;
  issuedAt: Date;
  recordedBy?: string | null;
};

function money(currency: string, amount: number) {
  return `${currency} ${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function buildSalesReceiptPdf(input: SalesReceiptPdfInput): Promise<Uint8Array> {
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
    documentLabel: "Payment receipt",
    documentNumber: input.receiptNumber,
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
      { label: "From", value: input.brand.companyName },
      { label: "To", value: input.customerName || "—" },
    ],
  });

  y = drawFinanceAmountBox({
    page,
    font,
    fontBold,
    margin,
    width,
    y,
    label: "Amount received",
    amount: money(input.currency, input.amount),
  });

  page.drawText(input.title, { x: margin, y, size: 12, font: fontBold, color: rgb(0.12, 0.12, 0.12) });
  y -= 24;

  y = drawFinanceKeyValueRows({
    page,
    font,
    fontBold,
    margin,
    y,
    rows: [
      ["Customer", input.customerName || "—"],
      ["Payment mode", input.paymentMode || "—"],
      ["Deposit account", input.depositAccount || "—"],
      ["Reference", input.reference || "—"],
      ["Recorded by", input.recordedBy || "—"],
    ],
  });

  if (input.note?.trim()) {
    y -= 8;
    page.drawText("NOTES", { x: margin, y, size: 8, font: fontBold, color: rgb(0.45, 0.45, 0.45) });
    y -= 14;
    for (const line of wrapText(input.note.trim(), 72)) {
      page.drawText(line, { x: margin, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
      y -= 12;
    }
  }

  drawFinanceFooter({
    page,
    font,
    margin,
    width,
    note: "Thank you for your payment. Please retain this receipt for your records.",
  });

  return doc.save();
}

export function salesReceiptPdfFileName(receiptNumber: string) {
  return `${receiptNumber.replace(/[^a-zA-Z0-9-_]/g, "-")}.pdf`;
}
