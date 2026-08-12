import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

export type ExportRow = Record<string, string | number>;

function csvCell(value: string | number) {
  const s = String(value ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename: string, headers: string[], rows: ExportRow[], keys: string[]) {
  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => keys.map((k) => csvCell(row[k] ?? "")).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

export async function downloadExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: ExportRow[],
  keys: string[],
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));
  sheet.addRow(headers);
  for (const row of rows) {
    sheet.addRow(keys.map((k) => row[k] ?? ""));
  }
  sheet.getRow(1).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

function fitPdfText(value: string | number, font: PDFFont, size: number, maxWidth: number) {
  const text = String(value ?? "");
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let fitted = text;
  while (fitted.length > 1 && font.widthOfTextAtSize(`${fitted}…`, size) > maxWidth) {
    fitted = fitted.slice(0, -1);
  }
  return `${fitted}…`;
}

export async function downloadTablePdf(
  filename: string,
  headers: string[],
  rows: ExportRow[],
  keys: string[],
) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const margin = 34;
  const rowHeight = 22;
  const columnWidth = (pageWidth - margin * 2) / Math.max(headers.length, 1);
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawHeader = () => {
    page.drawText(filename.replace(/[-_]+/g, " "), { x: margin, y, size: 16, font: bold, color: rgb(0.08, 0.1, 0.15) });
    y -= 28;
    page.drawRectangle({
      x: margin,
      y: y - 5,
      width: pageWidth - margin * 2,
      height: rowHeight,
      color: rgb(0.08, 0.1, 0.15),
    });
    headers.forEach((header, index) => {
      page.drawText(fitPdfText(header, bold, 8, columnWidth - 10), {
        x: margin + index * columnWidth + 5,
        y,
        size: 8,
        font: bold,
        color: rgb(1, 1, 1),
      });
    });
    y -= rowHeight;
  };

  drawHeader();
  rows.forEach((row, rowIndex) => {
    if (y < margin + rowHeight) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      drawHeader();
    }
    if (rowIndex % 2 === 0) {
      page.drawRectangle({
        x: margin,
        y: y - 5,
        width: pageWidth - margin * 2,
        height: rowHeight,
        color: rgb(0.96, 0.97, 0.98),
      });
    }
    keys.forEach((key, index) => {
      page.drawText(fitPdfText(row[key] ?? "", regular, 8, columnWidth - 10), {
        x: margin + index * columnWidth + 5,
        y,
        size: 8,
        font: regular,
        color: rgb(0.12, 0.14, 0.18),
      });
    });
    y -= rowHeight;
  });

  const bytes = await pdf.save();
  triggerDownload(
    new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" }),
    filename.endsWith(".pdf") ? filename : `${filename}.pdf`,
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
