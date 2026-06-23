import ExcelJS from "exceljs";
import {
  addBreakdownTable,
  addKpiCards,
  addReportBanner,
  addSectionTitle,
  addStyledDataTable,
  downloadWorkbook,
  type KpiItem,
  type ReportMeta,
} from "@/lib/report-xlsx-theme";

export type ModuleReportBreakdown = {
  title: string;
  rows: Array<{ label: string; value: number }>;
};

export type ModuleReportConfig = {
  filename: string;
  meta: ReportMeta;
  kpis?: KpiItem[];
  breakdowns?: ModuleReportBreakdown[];
  currency?: string;
  dataSheetName: string;
  headers: string[];
  keys: string[];
  rows: Array<Record<string, string | number>>;
};

export async function downloadModuleReportXlsx(config: ModuleReportConfig) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Realcorp";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Summary");
  addReportBanner(summary, config.meta, 8);

  let row = 5;
  if (config.kpis?.length) {
    row = addKpiCards(summary, row, config.kpis, config.currency);
  }

  if (config.breakdowns?.length) {
    for (const block of config.breakdowns) {
      if (block.rows.length === 0) continue;
      row = addBreakdownTable(summary, row, block.title, block.rows, config.currency);
      row += 1;
    }
  }

  const dataSheet = workbook.addWorksheet(config.dataSheetName.slice(0, 31));
  addReportBanner(dataSheet, { ...config.meta, title: config.dataSheetName }, config.headers.length);
  const startRow = (dataSheet.lastRow?.number ?? 0) + 1;
  addStyledDataTable(
    dataSheet,
    config.headers,
    config.rows.map((r) => config.keys.map((k) => r[k] ?? "")),
    { startRow },
  );

  await downloadWorkbook(workbook, config.filename);
}
