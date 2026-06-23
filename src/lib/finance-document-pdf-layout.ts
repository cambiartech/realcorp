import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from "pdf-lib";

export type FinancePdfBrand = {
  companyName: string;
  logoUrl?: string | null;
  orgAddress?: string | null;
  orgEmail?: string | null;
  orgPhone?: string | null;
};

const muted = rgb(0.45, 0.45, 0.45);
const text = rgb(0.12, 0.12, 0.12);
const border = rgb(0.88, 0.88, 0.88);

async function embedLogo(doc: PDFDocument, logoUrl?: string | null) {
  if (!logoUrl?.trim()) return null;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const type = res.headers.get("content-type") || logoUrl;
    if (type.includes("png")) return doc.embedPng(bytes);
    if (type.includes("webp")) return null;
    return doc.embedJpg(bytes);
  } catch {
    return null;
  }
}

export async function drawFinanceDocumentHeader(input: {
  doc: PDFDocument;
  page: PDFPage;
  brand: FinancePdfBrand;
  documentLabel: string;
  documentNumber: string;
  margin?: number;
}): Promise<number> {
  const { doc, page, brand, documentLabel, documentNumber } = input;
  const margin = input.margin ?? 48;
  const { width, height } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = height - margin;
  const logo = await embedLogo(doc, brand.logoUrl);
  if (logo) {
    const logoHeight = 42;
    const scale = logoHeight / logo.height;
    const logoWidth = logo.width * scale;
    page.drawImage(logo, { x: margin, y: y - logoHeight, width: logoWidth, height: logoHeight });
    y -= logoHeight + 8;
  }

  page.drawText(brand.companyName, { x: margin, y, size: 11, font: fontBold, color: text });
  y -= 14;

  const contact = [brand.orgAddress, brand.orgPhone, brand.orgEmail].filter(Boolean).join(" · ");
  if (contact) {
    page.drawText(contact.slice(0, 90), { x: margin, y, size: 8, font, color: muted });
    y -= 12;
  }

  const labelWidth = fontBold.widthOfTextAtSize(documentLabel.toUpperCase(), 8);
  page.drawText(documentLabel.toUpperCase(), {
    x: width - margin - labelWidth,
    y: height - margin - 8,
    size: 8,
    font: fontBold,
    color: muted,
  });
  const numSize = 18;
  const numWidth = fontBold.widthOfTextAtSize(documentNumber, numSize);
  page.drawText(documentNumber, {
    x: width - margin - numWidth,
    y: height - margin - 30,
    size: numSize,
    font: fontBold,
    color: text,
  });

  const headerBottom = Math.min(y, height - margin - 48) - 16;
  page.drawLine({ start: { x: margin, y: headerBottom }, end: { x: width - margin, y: headerBottom }, thickness: 1, color: border });
  return headerBottom - 20;
}

export async function drawFinanceMetaGrid(input: {
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  margin: number;
  y: number;
  width: number;
  rows: Array<{ label: string; value: string }>;
}): Promise<number> {
  let { y } = input;
  const colWidth = (input.width - input.margin * 2) / 2 - 12;
  let col = 0;
  for (const row of input.rows) {
    const x = input.margin + col * (colWidth + 24);
    input.page.drawText(row.label.toUpperCase(), { x, y, size: 8, font: input.fontBold, color: muted });
    const lines = wrapText(row.value, 38).slice(0, 3);
    let lineY = y - 14;
    for (const line of lines) {
      input.page.drawText(line, { x, y: lineY, size: 10, font: input.font, color: text });
      lineY -= 12;
    }
    col += 1;
    if (col >= 2) {
      col = 0;
      y = lineY - 8;
    }
  }
  if (col === 1) y -= 36;
  input.page.drawLine({
    start: { x: input.margin, y: y - 4 },
    end: { x: input.width - input.margin, y: y - 4 },
    thickness: 1,
    color: border,
  });
  return y - 24;
}

export function drawFinanceAmountBox(input: {
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  margin: number;
  width: number;
  y: number;
  label: string;
  amount: string;
}): number {
  const boxHeight = 52;
  const y = input.y - boxHeight;
  input.page.drawRectangle({
    x: input.margin,
    y,
    width: input.width - input.margin * 2,
    height: boxHeight,
    borderColor: border,
    borderWidth: 1,
    color: rgb(0.98, 0.98, 0.98),
  });
  input.page.drawText(input.label.toUpperCase(), {
    x: input.margin + 16,
    y: y + boxHeight - 18,
    size: 8,
    font: input.fontBold,
    color: muted,
  });
  input.page.drawText(input.amount, {
    x: input.margin + 16,
    y: y + 14,
    size: 18,
    font: input.fontBold,
    color: text,
  });
  return y - 20;
}

export function drawFinanceKeyValueRows(input: {
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  margin: number;
  y: number;
  rows: Array<[string, string]>;
}): number {
  let { y } = input;
  for (const [label, value] of input.rows) {
    input.page.drawText(label.toUpperCase(), { x: input.margin, y, size: 8, font: input.fontBold, color: muted });
    input.page.drawText(value.slice(0, 70), { x: input.margin + 120, y, size: 10, font: input.font, color: text });
    y -= 18;
  }
  return y;
}

export function drawFinanceFooter(input: {
  page: PDFPage;
  font: PDFFont;
  margin: number;
  width: number;
  note: string;
}) {
  input.page.drawText(input.note, {
    x: input.margin,
    y: 56,
    size: 9,
    font: input.font,
    color: muted,
  });
  input.page.drawText("Generated by Realcorp.", {
    x: input.margin,
    y: 40,
    size: 7,
    font: input.font,
    color: rgb(0.65, 0.65, 0.65),
  });
}

export function wrapText(text: string, maxLen: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLen) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 8);
}

export { muted, text, border, rgb };
