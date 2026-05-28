import ExcelJS from "exceljs";

export type ReportExportKind = "pnl" | "cashflow" | "expenses" | "balance";

export type ReportExportMeta = {
  companyName: string;
  generatedAtLabel: string;
  currency: string;
  windowMonths?: number;
};

type PnlRow = { month: string; invoiced: number; collected: number; expenses: number; net: number };
type CashflowRow = { month: string; inflow: number; outflow: number; net: number };
type ExpenseRow = { category: string; count: number; total: number };
type BalanceLine = { section: string; label: string; amount: number; tone?: "overdue" | "equity" };

const COLORS = {
  headerBg: "FF111827",
  headerFg: "FFFFFFFF",
  titleBg: "FFF3F4F6",
  assetBg: "FFDCFCE7",
  assetFg: "FF166534",
  liabilityBg: "FFFEE2E2",
  liabilityFg: "FF991B1B",
  equityBg: "FFDBEAFE",
  equityFg: "FF1E40AF",
  posFg: "FF059669",
  negFg: "FFDC2626",
  overdueFg: "FFDC2626",
  border: "FFE5E7EB",
} as const;

function moneyFormat(currency: string) {
  return `#,##0.00 "${currency}"`;
}

function styleMetaLabel(cell: ExcelJS.Cell) {
  cell.font = { bold: true, color: { argb: "FF374151" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.titleBg } };
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COLORS.headerFg } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.headerBg } };
    cell.alignment = { vertical: "middle" };
    cell.border = {
      bottom: { style: "thin", color: { argb: COLORS.border } },
    };
  });
  row.height = 22;
}

function toneFont(amount: number, bold = false): Partial<ExcelJS.Font> {
  const color = amount > 0 ? COLORS.posFg : amount < 0 ? COLORS.negFg : "FF6B7280";
  return { bold, color: { argb: color } };
}

function sectionStyle(section: string): { bg: string; fg: string } {
  if (section === "What you own") return { bg: COLORS.assetBg, fg: COLORS.assetFg };
  if (section === "What you owe") return { bg: COLORS.liabilityBg, fg: COLORS.liabilityFg };
  return { bg: COLORS.equityBg, fg: COLORS.equityFg };
}

function addMetaBlock(sheet: ExcelJS.Worksheet, meta: ReportExportMeta) {
  const rows: Array<[string, string]> = [
    ["Company", meta.companyName],
    ["Generated", meta.generatedAtLabel],
  ];
  if (meta.windowMonths) rows.push(["Period", `Last ${meta.windowMonths} months`]);
  for (const [label, value] of rows) {
    const row = sheet.addRow([label, value]);
    styleMetaLabel(row.getCell(1));
  }
  sheet.addRow([]);
}

function autoWidth(sheet: ExcelJS.Worksheet, min = 12, max = 44) {
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

function addPnlSheet(sheet: ExcelJS.Worksheet, meta: ReportExportMeta, rows: PnlRow[]) {
  sheet.name = "Profit & Loss";
  addMetaBlock(sheet, meta);
  const header = sheet.addRow(["Month", "Invoiced", "Collected", "Expenses", "Net"]);
  styleHeaderRow(header);
  for (const row of rows) {
    const excelRow = sheet.addRow([row.month, row.invoiced, row.collected, row.expenses, row.net]);
    excelRow.getCell(2).numFmt = moneyFormat(meta.currency);
    excelRow.getCell(3).numFmt = moneyFormat(meta.currency);
    excelRow.getCell(4).numFmt = moneyFormat(meta.currency);
    excelRow.getCell(5).numFmt = moneyFormat(meta.currency);
    excelRow.getCell(5).font = toneFont(row.net, true);
  }
  autoWidth(sheet);
}

function addCashflowSheet(sheet: ExcelJS.Worksheet, meta: ReportExportMeta, rows: CashflowRow[]) {
  sheet.name = "Cash Flow";
  addMetaBlock(sheet, meta);
  const header = sheet.addRow(["Month", "Inflow", "Outflow", "Net"]);
  styleHeaderRow(header);
  for (const row of rows) {
    const excelRow = sheet.addRow([row.month, row.inflow, row.outflow, row.net]);
    excelRow.getCell(2).numFmt = moneyFormat(meta.currency);
    excelRow.getCell(3).numFmt = moneyFormat(meta.currency);
    excelRow.getCell(4).numFmt = moneyFormat(meta.currency);
    excelRow.getCell(4).font = toneFont(row.net, true);
  }
  autoWidth(sheet);
}

function addExpensesSheet(sheet: ExcelJS.Worksheet, meta: ReportExportMeta, rows: ExpenseRow[]) {
  sheet.name = "Expenses";
  addMetaBlock(sheet, meta);
  const header = sheet.addRow(["Category", "Count", "Total"]);
  styleHeaderRow(header);
  for (const row of rows) {
    const excelRow = sheet.addRow([row.category, row.count, row.total]);
    excelRow.getCell(3).numFmt = moneyFormat(meta.currency);
  }
  autoWidth(sheet);
}

function addBalanceSheet(sheet: ExcelJS.Worksheet, meta: ReportExportMeta, lines: BalanceLine[]) {
  sheet.name = "Balance Sheet";
  addMetaBlock(sheet, meta);
  const header = sheet.addRow(["Section", "Line item", "Amount"]);
  styleHeaderRow(header);
  for (const line of lines) {
    const excelRow = sheet.addRow([line.section, line.label, line.amount]);
    const section = sectionStyle(line.section);
    excelRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: section.bg } };
    excelRow.getCell(1).font = { bold: true, color: { argb: section.fg } };
    excelRow.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: section.bg } };
    if (line.label.startsWith("Total")) {
      excelRow.getCell(2).font = { bold: true, color: { argb: section.fg } };
      excelRow.getCell(3).font = { bold: true, color: { argb: section.fg } };
    } else if (line.tone === "overdue") {
      excelRow.getCell(2).font = { color: { argb: COLORS.overdueFg }, italic: true };
      excelRow.getCell(3).font = { bold: true, color: { argb: COLORS.overdueFg } };
    } else if (line.tone === "equity") {
      excelRow.getCell(3).font = toneFont(line.amount, true);
    }
    excelRow.getCell(3).numFmt = moneyFormat(meta.currency);
  }
  autoWidth(sheet);
}

export async function downloadFinanceReportXlsx(
  kind: ReportExportKind,
  meta: ReportExportMeta,
  data: {
    pnl?: PnlRow[];
    cashflow?: CashflowRow[];
    expenses?: ExpenseRow[];
    balance?: BalanceLine[];
  },
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Realcorp Finance";
  workbook.created = new Date();

  if (kind === "pnl") addPnlSheet(workbook.addWorksheet("Profit & Loss"), meta, data.pnl || []);
  if (kind === "cashflow") addCashflowSheet(workbook.addWorksheet("Cash Flow"), meta, data.cashflow || []);
  if (kind === "expenses") addExpensesSheet(workbook.addWorksheet("Expenses"), meta, data.expenses || []);
  if (kind === "balance") addBalanceSheet(workbook.addWorksheet("Balance Sheet"), meta, data.balance || []);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement("a");
  a.href = url;
  a.download = `finance-${kind}-${stamp}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadFinanceReportPackXlsx(
  meta: ReportExportMeta,
  data: {
    pnl: PnlRow[];
    cashflow: CashflowRow[];
    expenses: ExpenseRow[];
    balance: BalanceLine[];
  },
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Realcorp Finance";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Summary");
  summary.addRow(["Finance report pack", meta.companyName]);
  summary.getCell("A1").font = { bold: true, size: 14 };
  summary.addRow(["Generated", meta.generatedAtLabel]);
  summary.addRow(["Currency", meta.currency]);
  if (meta.windowMonths) summary.addRow(["Period", `Last ${meta.windowMonths} months`]);
  summary.addRow([]);
  summary.addRow(["Sheets included", "Profit & Loss, Cash Flow, Expenses, Balance Sheet"]);
  styleMetaLabel(summary.getCell("A2"));
  styleMetaLabel(summary.getCell("A3"));
  styleMetaLabel(summary.getCell("A4"));
  autoWidth(summary);

  addPnlSheet(workbook.addWorksheet("Profit & Loss"), meta, data.pnl);
  addCashflowSheet(workbook.addWorksheet("Cash Flow"), meta, data.cashflow);
  addExpensesSheet(workbook.addWorksheet("Expenses"), meta, data.expenses);
  addBalanceSheet(workbook.addWorksheet("Balance Sheet"), meta, data.balance);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `finance-report-pack-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildBalanceExportLines(
  sections: {
    assets: Array<{ label: string; amount: number; sub?: boolean }>;
    liabilities: Array<{ label: string; amount: number }>;
    equity: Array<{ label: string; amount: number }>;
    assetsTotal: number;
    liabilitiesTotal: number;
    equityTotal: number;
  },
): BalanceLine[] {
  const lines: BalanceLine[] = [];
  for (const line of sections.assets) {
    lines.push({
      section: "What you own",
      label: line.label,
      amount: line.amount,
      tone: line.sub ? "overdue" : undefined,
    });
  }
  lines.push({ section: "What you own", label: "Total assets", amount: sections.assetsTotal });
  for (const line of sections.liabilities) {
    lines.push({ section: "What you owe", label: line.label, amount: line.amount });
  }
  lines.push({ section: "What you owe", label: "Total liabilities", amount: sections.liabilitiesTotal });
  for (const line of sections.equity) {
    lines.push({ section: "Owner position", label: line.label, amount: line.amount, tone: "equity" });
  }
  lines.push({ section: "Owner position", label: "Total equity", amount: sections.equityTotal, tone: "equity" });
  return lines;
}
