import ExcelJS from "exceljs";
import {
  addBreakdownTable,
  addComparisonBars,
  addKpiCards,
  addReportBanner,
  addSectionTitle,
  addStyledDataTable,
  autoWidth,
  downloadWorkbook,
  moneyFormat,
  REPORT_THEME,
  solidFill,
  styleHeaderRow,
  toneFont,
  type ReportMeta,
} from "@/lib/report-xlsx-theme";

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

type TransactionRow = {
  date: string;
  amount: number;
  description: string;
  category: string;
};

export type FinanceReportKpis = {
  totalInvoiced: number;
  totalCollected: number;
  totalExpenses: number;
  netCashflow: number;
  receivables: number;
  overdueReceivables: number;
};

function metaToReport(meta: ReportExportMeta, title: string): ReportMeta {
  return {
    title,
    companyName: meta.companyName,
    generatedAtLabel: meta.generatedAtLabel,
    currency: meta.currency,
    periodLabel: meta.windowMonths ? `Last ${meta.windowMonths} months` : undefined,
  };
}

function sum(rows: PnlRow[]) {
  return rows.reduce(
    (acc, r) => ({
      invoiced: acc.invoiced + r.invoiced,
      collected: acc.collected + r.collected,
      expenses: acc.expenses + r.expenses,
      net: acc.net + r.net,
    }),
    { invoiced: 0, collected: 0, expenses: 0, net: 0 },
  );
}

function addFinanceSummarySheet(
  sheet: ExcelJS.Worksheet,
  meta: ReportExportMeta,
  data: {
    pnl: PnlRow[];
    expenses: ExpenseRow[];
    kpis?: FinanceReportKpis;
  },
) {
  addReportBanner(sheet, metaToReport(meta, "Finance Report"), 10);
  const totals = sum(data.pnl);
  const kpis = data.kpis ?? {
    totalInvoiced: totals.invoiced,
    totalCollected: totals.collected,
    totalExpenses: totals.expenses,
    netCashflow: totals.net,
    receivables: 0,
    overdueReceivables: 0,
  };

  let row = addKpiCards(
    sheet,
    5,
    [
      { label: "Total collected", value: kpis.totalCollected, tone: "highlight" },
      { label: "Total expenses", value: kpis.totalExpenses, tone: "default" },
      {
        label: "Net cash flow",
        value: kpis.netCashflow,
        tone: kpis.netCashflow >= 0 ? "positive" : "negative",
      },
      {
        label: "Outstanding receivables",
        value: kpis.receivables,
        tone: kpis.receivables > 0 ? "negative" : "default",
      },
    ],
    meta.currency,
  );

  row = addSectionTitle(sheet, row, "Income vs expenses", 10);
  row = addComparisonBars(
    sheet,
    row,
    [
      {
        label: "Expenses",
        primary: kpis.totalExpenses,
        secondary: kpis.totalCollected,
        primaryLabel: "Expenses (outflow)",
        secondaryLabel: "Income collected (inflow)",
      },
    ],
    meta.currency,
  );

  if (data.pnl.length >= 2) {
    const first = data.pnl[0];
    const last = data.pnl[data.pnl.length - 1];
    row = addSectionTitle(sheet, row, "Period comparison", 10);
    row = addComparisonBars(
      sheet,
      row,
      [
        {
          label: "Opening month net",
          primary: first.net,
          secondary: last.net,
          primaryLabel: first.month,
          secondaryLabel: last.month,
        },
        {
          label: "Opening month collected",
          primary: first.collected,
          secondary: last.collected,
          primaryLabel: first.month,
          secondaryLabel: last.month,
        },
      ],
      meta.currency,
    );
  }

  if (data.expenses.length > 0) {
    row = addBreakdownTable(
      sheet,
      row,
      "Expenses by category",
      data.expenses.map((e) => ({ label: e.category, value: e.total })),
      meta.currency,
    );
  }

  autoWidth(sheet);
}

function addPnlSheet(sheet: ExcelJS.Worksheet, meta: ReportExportMeta, rows: PnlRow[]) {
  addReportBanner(sheet, metaToReport(meta, "Profit & Loss"), 6);
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
  const totals = sum(rows);
  const totalRow = sheet.addRow(["Total", totals.invoiced, totals.collected, totals.expenses, totals.net]);
  totalRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: REPORT_THEME.green } };
    cell.fill = solidFill(REPORT_THEME.greenLight);
  });
  totalRow.getCell(2).numFmt = moneyFormat(meta.currency);
  totalRow.getCell(3).numFmt = moneyFormat(meta.currency);
  totalRow.getCell(4).numFmt = moneyFormat(meta.currency);
  totalRow.getCell(5).numFmt = moneyFormat(meta.currency);
  autoWidth(sheet);
}

function addCashflowSheet(sheet: ExcelJS.Worksheet, meta: ReportExportMeta, rows: CashflowRow[]) {
  addReportBanner(sheet, metaToReport(meta, "Cash Flow"), 5);
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
  addReportBanner(sheet, metaToReport(meta, "Expense Analysis"), 6);
  addBreakdownTable(
    sheet,
    5,
    "Category breakdown",
    rows.map((r) => ({ label: r.category, value: r.total })),
    meta.currency,
  );
  const headerRow = (sheet.lastRow?.number ?? 10) + 2;
  const header = sheet.getRow(headerRow);
  header.values = ["Category", "Transactions", "Total"];
  styleHeaderRow(header);
  rows.forEach((row, idx) => {
    const excelRow = sheet.getRow(headerRow + 1 + idx);
    excelRow.values = [row.category, row.count, row.total];
    excelRow.getCell(3).numFmt = moneyFormat(meta.currency);
    if (idx % 2 === 1)
      excelRow.eachCell((c) => {
        c.fill = solidFill(REPORT_THEME.stripe);
      });
  });
  autoWidth(sheet);
}

function addBalanceSheet(sheet: ExcelJS.Worksheet, meta: ReportExportMeta, lines: BalanceLine[]) {
  addReportBanner(sheet, metaToReport(meta, "Balance Sheet"), 4);
  const header = sheet.addRow(["Section", "Line item", "Amount"]);
  styleHeaderRow(header);
  for (const line of lines) {
    const excelRow = sheet.addRow([line.section, line.label, line.amount]);
    excelRow.getCell(3).numFmt = moneyFormat(meta.currency);
    if (line.label.startsWith("Total")) {
      excelRow.getCell(2).font = { bold: true };
      excelRow.getCell(3).font = { bold: true };
    } else if (line.tone === "overdue") {
      excelRow.getCell(2).font = { color: { argb: REPORT_THEME.red }, italic: true };
      excelRow.getCell(3).font = { bold: true, color: { argb: REPORT_THEME.red } };
    } else if (line.tone === "equity") {
      excelRow.getCell(3).font = toneFont(line.amount, true);
    }
  }
  autoWidth(sheet);
}

function addTransactionsSheet(
  sheet: ExcelJS.Worksheet,
  meta: ReportExportMeta,
  income: TransactionRow[],
  expenses: TransactionRow[],
) {
  addReportBanner(sheet, metaToReport(meta, "Transactions"), 8);

  let row = addSectionTitle(sheet, 5, "Income (collections)", 8);
  addStyledDataTable(
    sheet,
    ["Date", "Amount", "Description", "Category"],
    income.map((t) => [t.date, t.amount, t.description, t.category]),
    { currency: meta.currency, moneyColumns: [2], startRow: row },
  );

  row = (sheet.lastRow?.number ?? row) + 2;
  row = addSectionTitle(sheet, row, "Expenses", 8);
  addStyledDataTable(
    sheet,
    ["Date", "Amount", "Description", "Category"],
    expenses.map((t) => [t.date, t.amount, t.description, t.category]),
    { currency: meta.currency, moneyColumns: [2], startRow: row },
  );
}

function createWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Realcorp";
  workbook.created = new Date();
  return workbook;
}

export async function downloadFinanceReportXlsx(
  kind: ReportExportKind,
  meta: ReportExportMeta,
  data: {
    pnl?: PnlRow[];
    cashflow?: CashflowRow[];
    expenses?: ExpenseRow[];
    balance?: BalanceLine[];
    kpis?: FinanceReportKpis;
    incomeTransactions?: TransactionRow[];
    expenseTransactions?: TransactionRow[];
  },
) {
  const workbook = createWorkbook();
  const stamp = new Date().toISOString().slice(0, 10);

  if (kind === "pnl") {
    addFinanceSummarySheet(workbook.addWorksheet("Summary"), meta, {
      pnl: data.pnl || [],
      expenses: data.expenses || [],
      kpis: data.kpis,
    });
    addPnlSheet(workbook.addWorksheet("Profit & Loss"), meta, data.pnl || []);
  }
  if (kind === "cashflow") {
    addFinanceSummarySheet(workbook.addWorksheet("Summary"), meta, {
      pnl: data.pnl || [],
      expenses: data.expenses || [],
      kpis: data.kpis,
    });
    addCashflowSheet(workbook.addWorksheet("Cash Flow"), meta, data.cashflow || []);
  }
  if (kind === "expenses") {
    addFinanceSummarySheet(workbook.addWorksheet("Summary"), meta, {
      pnl: data.pnl || [],
      expenses: data.expenses || [],
      kpis: data.kpis,
    });
    addExpensesSheet(workbook.addWorksheet("Expenses"), meta, data.expenses || []);
    if (data.expenseTransactions?.length) {
      addTransactionsSheet(workbook.addWorksheet("Transactions"), meta, [], data.expenseTransactions);
    }
  }
  if (kind === "balance") {
    addBalanceSheet(workbook.addWorksheet("Balance Sheet"), meta, data.balance || []);
  }

  await downloadWorkbook(workbook, `finance-${kind}-${stamp}.xlsx`);
}

export async function downloadFinanceReportPackXlsx(
  meta: ReportExportMeta,
  data: {
    pnl: PnlRow[];
    cashflow: CashflowRow[];
    expenses: ExpenseRow[];
    balance: BalanceLine[];
    kpis?: FinanceReportKpis;
    incomeTransactions?: TransactionRow[];
    expenseTransactions?: TransactionRow[];
  },
) {
  const workbook = createWorkbook();

  addFinanceSummarySheet(workbook.addWorksheet("Summary"), meta, {
    pnl: data.pnl,
    expenses: data.expenses,
    kpis: data.kpis,
  });
  addPnlSheet(workbook.addWorksheet("Profit & Loss"), meta, data.pnl);
  addCashflowSheet(workbook.addWorksheet("Cash Flow"), meta, data.cashflow);
  addExpensesSheet(workbook.addWorksheet("Expenses"), meta, data.expenses);
  addBalanceSheet(workbook.addWorksheet("Balance Sheet"), meta, data.balance);
  addTransactionsSheet(
    workbook.addWorksheet("Transactions"),
    meta,
    data.incomeTransactions || [],
    data.expenseTransactions || [],
  );

  await downloadWorkbook(workbook, `finance-report-pack-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function buildBalanceExportLines(sections: {
  assets: Array<{ label: string; amount: number; sub?: boolean }>;
  liabilities: Array<{ label: string; amount: number }>;
  equity: Array<{ label: string; amount: number }>;
  assetsTotal: number;
  liabilitiesTotal: number;
  equityTotal: number;
}): BalanceLine[] {
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
  lines.push({
    section: "Owner position",
    label: "Total equity",
    amount: sections.equityTotal,
    tone: "equity",
  });
  return lines;
}

export type { TransactionRow };
