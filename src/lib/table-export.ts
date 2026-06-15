import ExcelJS from "exceljs";

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

export function downloadPdfViaPrint() {
  window.print();
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
