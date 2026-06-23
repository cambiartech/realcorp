import ExcelJS from "exceljs";

/** Realcorp report palette — navy + gold accent, meeting-ready. */
export const REPORT_THEME = {
  navy: "FF111827",
  navyMid: "FF1E3A5F",
  gold: "FFD97706",
  goldLight: "FFFEF3C7",
  goldBorder: "FFF59E0B",
  orange: "FFEA580C",
  green: "FF166534",
  greenLight: "FFDCFCE7",
  blue: "FF1E40AF",
  blueLight: "FFDBEAFE",
  red: "FFDC2626",
  redLight: "FFFEE2E2",
  muted: "FF6B7280",
  mutedLight: "FFF3F4F6",
  border: "FFE5E7EB",
  stripe: "FFFFF7ED",
  white: "FFFFFFFF",
  posFg: "FF059669",
  negFg: "FFDC2626",
} as const;

export type ReportMeta = {
  title: string;
  companyName: string;
  generatedAtLabel: string;
  periodLabel?: string;
  currency?: string;
  subtitle?: string;
};

export type KpiItem = {
  label: string;
  value: string | number;
  tone?: "default" | "positive" | "negative" | "highlight";
};

export type ComparisonItem = {
  label: string;
  primary: number;
  secondary?: number;
  primaryLabel?: string;
  secondaryLabel?: string;
};

export type BreakdownRow = {
  label: string;
  value: number;
  share?: number;
};

export function moneyFormat(currency: string) {
  return `#,##0.00 "${currency}"`;
}

export function solidFill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

export function thinBorder(color: string = REPORT_THEME.border): Partial<ExcelJS.Borders> {
  const edge = { style: "thin" as const, color: { argb: color } };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

export function addReportBanner(sheet: ExcelJS.Worksheet, meta: ReportMeta, colSpan = 8) {
  const endCol = String.fromCharCode(64 + colSpan);
  sheet.mergeCells(`A1:${endCol}1`);
  const titleCell = sheet.getCell("A1");
  titleCell.value = meta.title;
  titleCell.font = { bold: true, size: 18, color: { argb: REPORT_THEME.white } };
  titleCell.fill = solidFill(REPORT_THEME.navy);
  titleCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(1).height = 36;

  sheet.mergeCells(`A2:${endCol}2`);
  const subCell = sheet.getCell("A2");
  subCell.value = [meta.companyName, meta.subtitle].filter(Boolean).join(" · ");
  subCell.font = { size: 11, color: { argb: REPORT_THEME.white } };
  subCell.fill = solidFill(REPORT_THEME.navyMid);
  subCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  sheet.getRow(2).height = 22;

  const metaRow = sheet.addRow([
    `Generated: ${meta.generatedAtLabel}`,
    meta.periodLabel ? `Period: ${meta.periodLabel}` : "",
    meta.currency ? `Currency: ${meta.currency}` : "",
  ]);
  metaRow.eachCell((cell, col) => {
    if (col <= 3 && cell.value) {
      cell.font = { bold: true, size: 10, color: { argb: REPORT_THEME.muted } };
      cell.fill = solidFill(REPORT_THEME.mutedLight);
    }
  });
  sheet.addRow([]);
  return sheet.lastRow?.number ?? 4;
}

export function addKpiCards(sheet: ExcelJS.Worksheet, startRow: number, kpis: KpiItem[], currency?: string) {
  const row = sheet.getRow(startRow);
  row.height = 52;
  const colWidth = Math.max(2, Math.floor(10 / Math.max(kpis.length, 1)));

  kpis.forEach((kpi, i) => {
    const col = 1 + i * colWidth;
    const labelCell = sheet.getCell(startRow, col);
    const valueCell = sheet.getCell(startRow + 1, col);

    if (colWidth > 1) {
      sheet.mergeCells(startRow, col, startRow, col + colWidth - 1);
      sheet.mergeCells(startRow + 1, col, startRow + 1, col + colWidth - 1);
    }

    labelCell.value = kpi.label.toUpperCase();
    labelCell.font = { bold: true, size: 9, color: { argb: REPORT_THEME.muted } };
    labelCell.alignment = { horizontal: "center", vertical: "bottom" };

    const display =
      typeof kpi.value === "number" && currency
        ? kpi.value
        : kpi.value;
    valueCell.value = display;
    if (typeof kpi.value === "number" && currency) {
      valueCell.numFmt = moneyFormat(currency);
    }
    valueCell.font = {
      bold: true,
      size: 16,
      color: {
        argb:
          kpi.tone === "positive"
            ? REPORT_THEME.posFg
            : kpi.tone === "negative"
              ? REPORT_THEME.negFg
              : kpi.tone === "highlight"
                ? REPORT_THEME.gold
                : REPORT_THEME.navy,
      },
    };
    valueCell.alignment = { horizontal: "center", vertical: "top" };

    for (let c = col; c < col + colWidth; c++) {
      sheet.getCell(startRow, c).fill = solidFill(kpi.tone === "highlight" ? REPORT_THEME.goldLight : REPORT_THEME.white);
      sheet.getCell(startRow, c).border = thinBorder(REPORT_THEME.goldBorder);
      sheet.getCell(startRow + 1, c).fill = solidFill(kpi.tone === "highlight" ? REPORT_THEME.goldLight : REPORT_THEME.white);
      sheet.getCell(startRow + 1, c).border = thinBorder(REPORT_THEME.goldBorder);
    }
  });

  return startRow + 3;
}

export function addSectionTitle(sheet: ExcelJS.Worksheet, row: number, title: string, colSpan = 8) {
  sheet.mergeCells(row, 1, row, colSpan);
  const cell = sheet.getCell(row, 1);
  cell.value = title;
  cell.font = { bold: true, size: 13, color: { argb: REPORT_THEME.green } };
  cell.alignment = { vertical: "middle" };
  sheet.getRow(row).height = 24;
  return row + 1;
}

/** Horizontal bar comparison — mimics chart bars using filled cells. */
export function addComparisonBars(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  items: ComparisonItem[],
  currency: string,
  barCols = 20,
) {
  const barStartCol = 4;
  const maxVal = Math.max(...items.flatMap((x) => [x.primary, x.secondary ?? 0]), 1);

  for (const item of items) {
    const labelRow = sheet.addRow([item.label]);
    labelRow.getCell(1).font = { bold: true, size: 11, color: { argb: REPORT_THEME.navy } };

    if (item.secondary !== undefined) {
      const secLabel = item.secondaryLabel || "Comparison";
      const priLabel = item.primaryLabel || "Actual";
      const secRow = sheet.addRow([secLabel, item.secondary]);
      secRow.getCell(1).font = { size: 10, color: { argb: REPORT_THEME.muted } };
      secRow.getCell(2).numFmt = moneyFormat(currency);
      secRow.getCell(2).font = { bold: true, color: { argb: REPORT_THEME.muted } };
      paintBar(sheet, secRow.number, barStartCol, barCols, item.secondary / maxVal, REPORT_THEME.mutedLight, REPORT_THEME.goldBorder);

      const priRow = sheet.addRow([priLabel, item.primary]);
      priRow.getCell(1).font = { size: 10, color: { argb: REPORT_THEME.navy } };
      priRow.getCell(2).numFmt = moneyFormat(currency);
      priRow.getCell(2).font = { bold: true, color: { argb: REPORT_THEME.navy } };
      paintBar(sheet, priRow.number, barStartCol, barCols, item.primary / maxVal, REPORT_THEME.navyMid, REPORT_THEME.navy);
    } else {
      const row = sheet.addRow(["Total", item.primary]);
      row.getCell(1).font = { size: 10, color: { argb: REPORT_THEME.navy } };
      row.getCell(2).numFmt = moneyFormat(currency);
      row.getCell(2).font = { bold: true, color: { argb: REPORT_THEME.navy } };
      paintBar(sheet, row.number, barStartCol, barCols, item.primary / maxVal, REPORT_THEME.orange, REPORT_THEME.gold);
    }

    sheet.addRow([]);
  }

  return (sheet.lastRow?.number ?? startRow) + 1;
}

function paintBar(
  sheet: ExcelJS.Worksheet,
  rowNum: number,
  startCol: number,
  width: number,
  ratio: number,
  fill: string,
  border: string,
) {
  const filled = Math.max(1, Math.round(Math.min(1, ratio) * width));
  for (let i = 0; i < width; i++) {
    const cell = sheet.getCell(rowNum, startCol + i);
    cell.fill = solidFill(i < filled ? fill : REPORT_THEME.white);
    cell.border = { top: { style: "thin", color: { argb: border } }, bottom: { style: "thin", color: { argb: border } } };
    if (i === 0) cell.border = { ...cell.border, left: { style: "thin", color: { argb: border } } };
    if (i === width - 1) cell.border = { ...cell.border, right: { style: "thin", color: { argb: border } } };
  }
}

export function addBreakdownTable(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  title: string,
  rows: BreakdownRow[],
  currency?: string,
  withBars = true,
) {
  let r = addSectionTitle(sheet, startRow, title);
  const header = sheet.getRow(r);
  header.values = ["Category", "Amount", "Share", ...(withBars ? ["", ""] : [])];
  styleHeaderRow(header);
  r++;

  const total = rows.reduce((s, x) => s + x.value, 0) || 1;
  const max = Math.max(...rows.map((x) => x.value), 1);

  rows.forEach((row, idx) => {
    const share = row.share ?? (row.value / total) * 100;
    const dataRow = sheet.getRow(r);
    dataRow.values = [
      row.label,
      row.value,
      share / 100,
      ...(withBars ? ["", ""] : []),
    ];
    dataRow.getCell(2).numFmt = currency ? moneyFormat(currency) : "#,##0";
    dataRow.getCell(3).numFmt = "0.0%";
    dataRow.getCell(3).font = { color: { argb: REPORT_THEME.muted } };

    if (idx % 2 === 1) {
      dataRow.eachCell((cell) => {
        cell.fill = solidFill(REPORT_THEME.stripe);
      });
    }

    if (withBars) {
      paintBar(sheet, r, 5, 16, row.value / max, REPORT_THEME.navyMid, REPORT_THEME.navy);
    }
    r++;
  });

  const totalRow = sheet.getRow(r);
  totalRow.values = ["Total", total, 1, ...(withBars ? ["", ""] : [])];
  totalRow.getCell(1).font = { bold: true, color: { argb: REPORT_THEME.green } };
  totalRow.getCell(2).numFmt = currency ? moneyFormat(currency) : "#,##0";
  totalRow.getCell(2).font = { bold: true, color: { argb: REPORT_THEME.green } };
  totalRow.getCell(3).numFmt = "0.0%";
  totalRow.getCell(3).font = { bold: true };
  totalRow.eachCell((cell) => {
    cell.fill = solidFill(REPORT_THEME.greenLight);
  });

  return r + 2;
}

export function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, size: 10, color: { argb: REPORT_THEME.white } };
    cell.fill = solidFill(REPORT_THEME.navy);
    cell.alignment = { vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: REPORT_THEME.border } } };
  });
  row.height = 22;
}

export function addStyledDataTable(
  sheet: ExcelJS.Worksheet,
  headers: string[],
  rows: Array<Array<string | number | null>>,
  options?: {
    currency?: string;
    moneyColumns?: number[];
    percentColumns?: number[];
    startRow?: number;
  },
) {
  const startRow = options?.startRow ?? (sheet.lastRow?.number ?? 0) + 1;
  const headerRow = sheet.getRow(startRow);
  headerRow.values = headers;
  styleHeaderRow(headerRow);

  rows.forEach((values, idx) => {
    const row = sheet.getRow(startRow + 1 + idx);
    row.values = values;
    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = solidFill(REPORT_THEME.stripe);
      });
    }
    options?.moneyColumns?.forEach((col) => {
      const cell = row.getCell(col);
      if (typeof cell.value === "number" && options.currency) {
        cell.numFmt = moneyFormat(options.currency);
      }
    });
    options?.percentColumns?.forEach((col) => {
      row.getCell(col).numFmt = "0.0%";
    });
  });

  autoWidth(sheet);
  return startRow + 1 + rows.length;
}

export function autoWidth(sheet: ExcelJS.Worksheet, min = 10, max = 48) {
  sheet.columns.forEach((column) => {
    if (!column) return;
    let width = min;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = String(cell.value ?? "").length;
      width = Math.max(width, Math.min(max, len + 2));
    });
    column.width = width;
  });
}

export function toneFont(amount: number, bold = false): Partial<ExcelJS.Font> {
  const color = amount > 0 ? REPORT_THEME.posFg : amount < 0 ? REPORT_THEME.negFg : REPORT_THEME.muted;
  return { bold, color: { argb: color } };
}

export async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
