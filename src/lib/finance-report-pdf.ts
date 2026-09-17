import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { FinanceReportKpis, ReportExportMeta } from "@/lib/finance-report-xlsx";

type PnlRow = { month: string; invoiced: number; collected: number; expenses: number; remitted?: number; net: number };
type CashflowRow = { month: string; inflow: number; outflow: number; net: number };
type ExpenseRow = { category: string; count: number; total: number };
type BalanceLine = { section: string; label: string; amount: number };
type IncomeDimensionRow = {
  label: string;
  collected: number;
  deposits: number;
  shortlet: number;
  other: number;
};
type ClientBalanceRow = {
  clientName: string;
  projectLabel: string;
  unitLabel: string;
  contractValue: number;
  depositsPaid: number;
  collected: number;
  remaining: number;
};

type ReportPdfData = {
  pnl: PnlRow[];
  cashflow: CashflowRow[];
  expenses: ExpenseRow[];
  balance: BalanceLine[];
  kpis?: FinanceReportKpis;
  incomeByProject?: IncomeDimensionRow[];
  clientBalances?: ClientBalanceRow[];
};

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 36;
const NAVY = rgb(0.07, 0.09, 0.15);
const MUTED = rgb(0.42, 0.45, 0.5);
const STRIPE = rgb(0.97, 0.98, 0.99);
const WHITE = rgb(1, 1, 1);

function money(currency: string, amount: number) {
  return `${currency} ${Number(amount || 0).toLocaleString("en-NG")}`;
}

function reportFileSlug(meta: ReportExportMeta) {
  return (
    (meta.scopeLabel || "all-projects")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "all-projects"
  );
}

function fitPdfText(value: string, font: PDFFont, size: number, maxWidth: number) {
  const text = String(value ?? "");
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let fitted = text;
  while (fitted.length > 1 && font.widthOfTextAtSize(`${fitted}…`, size) > maxWidth) {
    fitted = fitted.slice(0, -1);
  }
  return `${fitted}…`;
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

type PdfCtx = {
  pdf: PDFDocument;
  regular: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number;
};

function newPage(ctx: PdfCtx) {
  ctx.page = ctx.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.y = PAGE_HEIGHT - MARGIN;
}

function ensureSpace(ctx: PdfCtx, needed: number) {
  if (ctx.y - needed < MARGIN) newPage(ctx);
}

function drawHeader(ctx: PdfCtx, meta: ReportExportMeta, title = "Financial statement") {
  ctx.page.drawText(meta.companyName || "Realcorp", {
    x: MARGIN,
    y: ctx.y,
    size: 11,
    font: ctx.bold,
    color: NAVY,
  });
  ctx.page.drawText(meta.generatedAtLabel || "", {
    x: PAGE_WIDTH - MARGIN - ctx.regular.widthOfTextAtSize(meta.generatedAtLabel || "", 9),
    y: ctx.y,
    size: 9,
    font: ctx.regular,
    color: MUTED,
  });
  ctx.y -= 18;
  ctx.page.drawText(title, {
    x: MARGIN,
    y: ctx.y,
    size: 18,
    font: ctx.bold,
    color: NAVY,
  });
  ctx.y -= 16;
  const scope = meta.scopeLabel ? `Scope: ${meta.scopeLabel}` : "Scope: All projects";
  const period = meta.windowMonths ? ` · Last ${meta.windowMonths} months` : "";
  ctx.page.drawText(`${scope}${period}`, {
    x: MARGIN,
    y: ctx.y,
    size: 10,
    font: ctx.regular,
    color: MUTED,
  });
  ctx.y -= 18;
  ctx.page.drawRectangle({
    x: MARGIN,
    y: ctx.y,
    width: PAGE_WIDTH - MARGIN * 2,
    height: 1.2,
    color: NAVY,
  });
  ctx.y -= 16;
}

function drawSectionTitle(ctx: PdfCtx, title: string) {
  ensureSpace(ctx, 28);
  ctx.page.drawText(title, {
    x: MARGIN,
    y: ctx.y,
    size: 12,
    font: ctx.bold,
    color: NAVY,
  });
  ctx.y -= 14;
}

function drawTable(ctx: PdfCtx, headers: string[], rows: string[][]) {
  const colCount = Math.max(headers.length, 1);
  const tableWidth = PAGE_WIDTH - MARGIN * 2;
  const colWidth = tableWidth / colCount;
  const rowHeight = 18;

  const drawHeaderRow = () => {
    ensureSpace(ctx, rowHeight + 4);
    ctx.page.drawRectangle({
      x: MARGIN,
      y: ctx.y - 5,
      width: tableWidth,
      height: rowHeight,
      color: NAVY,
    });
    headers.forEach((header, index) => {
      ctx.page.drawText(fitPdfText(header, ctx.bold, 8, colWidth - 10), {
        x: MARGIN + index * colWidth + 5,
        y: ctx.y,
        size: 8,
        font: ctx.bold,
        color: WHITE,
      });
    });
    ctx.y -= rowHeight;
  };

  drawHeaderRow();
  if (!rows.length) {
    ensureSpace(ctx, rowHeight);
    ctx.page.drawText("No rows in this scope.", {
      x: MARGIN + 5,
      y: ctx.y,
      size: 8,
      font: ctx.regular,
      color: MUTED,
    });
    ctx.y -= rowHeight + 8;
    return;
  }

  rows.forEach((row, rowIndex) => {
    if (ctx.y < MARGIN + rowHeight) {
      newPage(ctx);
      drawHeaderRow();
    }
    if (rowIndex % 2 === 0) {
      ctx.page.drawRectangle({
        x: MARGIN,
        y: ctx.y - 5,
        width: tableWidth,
        height: rowHeight,
        color: STRIPE,
      });
    }
    row.forEach((cell, index) => {
      ctx.page.drawText(fitPdfText(cell, ctx.regular, 8, colWidth - 10), {
        x: MARGIN + index * colWidth + 5,
        y: ctx.y,
        size: 8,
        font: ctx.regular,
        color: NAVY,
      });
    });
    ctx.y -= rowHeight;
  });
  ctx.y -= 12;
}

export async function downloadFinanceReportPdf(meta: ReportExportMeta, data: ReportPdfData) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Financial statement · ${meta.scopeLabel || "All projects"}`);
  pdf.setAuthor(meta.companyName || "Realcorp");
  pdf.setCreator("Realcorp");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ctx: PdfCtx = {
    pdf,
    regular,
    bold,
    page: pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: PAGE_HEIGHT - MARGIN,
  };

  const pnlTotals = data.pnl.reduce(
    (acc, row) => ({
      invoiced: acc.invoiced + row.invoiced,
      collected: acc.collected + row.collected,
      expenses: acc.expenses + row.expenses,
      remitted: acc.remitted + Number(row.remitted || 0),
      net: acc.net + row.net,
    }),
    { invoiced: 0, collected: 0, expenses: 0, remitted: 0, net: 0 },
  );
  const kpis = data.kpis ?? {
    totalInvoiced: pnlTotals.invoiced,
    totalCollected: pnlTotals.collected,
    totalExpenses: pnlTotals.expenses,
    totalRemitted: pnlTotals.remitted,
    netCashflow: pnlTotals.net,
    receivables: 0,
    overdueReceivables: 0,
  };

  drawHeader(ctx, meta);
  drawSectionTitle(ctx, "Statement summary");
  drawTable(
    ctx,
    ["Invoiced", "Collected", "Expenses", "Remitted", "Money left", "Receivables"],
    [
      [
        money(meta.currency, kpis.totalInvoiced),
        money(meta.currency, kpis.totalCollected),
        money(meta.currency, kpis.totalExpenses),
        money(meta.currency, kpis.totalRemitted ?? pnlTotals.remitted),
        money(meta.currency, kpis.netCashflow),
        money(meta.currency, kpis.receivables),
      ],
    ],
  );

  drawSectionTitle(ctx, "Profit & loss");
  drawTable(ctx, ["Month", "Invoiced", "Collected", "Expenses", "Remitted", "Net"], [
    ...data.pnl.map((row) => [
      row.month,
      money(meta.currency, row.invoiced),
      money(meta.currency, row.collected),
      money(meta.currency, row.expenses),
      money(meta.currency, Number(row.remitted || 0)),
      money(meta.currency, row.net),
    ]),
    [
      "Total",
      money(meta.currency, pnlTotals.invoiced),
      money(meta.currency, pnlTotals.collected),
      money(meta.currency, pnlTotals.expenses),
      money(meta.currency, pnlTotals.remitted),
      money(meta.currency, pnlTotals.net),
    ],
  ]);

  drawSectionTitle(ctx, "Cash flow");
  drawTable(
    ctx,
    ["Month", "Inflow", "Outflow", "Net"],
    data.cashflow.map((row) => [
      row.month,
      money(meta.currency, row.inflow),
      money(meta.currency, row.outflow),
      money(meta.currency, row.net),
    ]),
  );

  drawSectionTitle(ctx, "Expenses");
  drawTable(
    ctx,
    ["Category", "Transactions", "Total"],
    data.expenses.map((row) => [row.category, String(row.count), money(meta.currency, row.total)]),
  );

  if (data.incomeByProject?.length) {
    drawSectionTitle(ctx, "Income by project / room");
    drawTable(
      ctx,
      ["Project / room", "Collected", "Client deposits", "Short let", "Other"],
      data.incomeByProject.map((row) => [
        row.label,
        money(meta.currency, row.collected),
        money(meta.currency, row.deposits),
        money(meta.currency, row.shortlet),
        money(meta.currency, row.other),
      ]),
    );
  }

  if (data.clientBalances?.length) {
    drawSectionTitle(ctx, "Client deposits");
    drawTable(
      ctx,
      ["Client", "Project", "Apartment / room", "Contract", "Collected", "Remaining"],
      data.clientBalances.slice(0, 80).map((row) => [
        row.clientName,
        row.projectLabel,
        row.unitLabel,
        money(meta.currency, row.contractValue),
        money(meta.currency, row.collected),
        money(meta.currency, row.remaining),
      ]),
    );
  }

  if (data.balance.length) {
    drawSectionTitle(ctx, "Balance sheet");
    drawTable(
      ctx,
      ["Section", "Line item", "Amount"],
      data.balance.map((line) => [line.section, line.label, money(meta.currency, line.amount)]),
    );
  }

  const bytes = await pdf.save();
  triggerDownload(
    new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" }),
    `finance-statement-${reportFileSlug(meta)}-${new Date().toISOString().slice(0, 10)}.pdf`,
  );
}

type ExpenseStatementPdfData = {
  expenses: ExpenseRow[];
  expenseTransactions?: Array<{
    date: string;
    amount: number;
    description: string;
    category: string;
  }>;
  kpis?: Pick<FinanceReportKpis, "totalExpenses">;
};

type ScopedTable = {
  title: string;
  headers: string[];
  rows: string[][];
};

async function downloadScopedStatementPdf(input: {
  meta: ReportExportMeta;
  title: string;
  filePrefix: string;
  summaryHeaders: string[];
  summaryRow: string[];
  tables: ScopedTable[];
}) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${input.title} · ${input.meta.scopeLabel || "All projects"}`);
  pdf.setAuthor(input.meta.companyName || "Realcorp");
  pdf.setCreator("Realcorp");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ctx: PdfCtx = {
    pdf,
    regular,
    bold,
    page: pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
    y: PAGE_HEIGHT - MARGIN,
  };

  drawHeader(ctx, input.meta, input.title);
  drawSectionTitle(ctx, "Summary");
  drawTable(ctx, input.summaryHeaders, [input.summaryRow]);
  for (const table of input.tables) {
    drawSectionTitle(ctx, table.title);
    drawTable(ctx, table.headers, table.rows);
  }

  const bytes = await pdf.save();
  triggerDownload(
    new Blob([Uint8Array.from(bytes).buffer], { type: "application/pdf" }),
    `${input.filePrefix}-${reportFileSlug(input.meta)}-${new Date().toISOString().slice(0, 10)}.pdf`,
  );
}

/** Department / project expense statement — spend only, no invoiced / collected / remitted. */
export async function downloadFinanceExpenseStatementPdf(
  meta: ReportExportMeta,
  data: ExpenseStatementPdfData,
) {
  const totalExpenses =
    data.kpis?.totalExpenses ??
    data.expenses.reduce((sum, row) => sum + row.total, 0);
  const totalCount = data.expenses.reduce((sum, row) => sum + row.count, 0);
  const tables: ScopedTable[] = [
    {
      title: "Expenses by category",
      headers: ["Category", "Transactions", "Total"],
      rows: data.expenses.map((row) => [
        row.category,
        String(row.count),
        money(meta.currency, row.total),
      ]),
    },
  ];
  if (data.expenseTransactions?.length) {
    tables.push({
      title: "Expense transactions",
      headers: ["Date", "Category", "Description", "Amount"],
      rows: data.expenseTransactions.slice(0, 120).map((row) => [
        row.date,
        row.category,
        row.description,
        money(meta.currency, row.amount),
      ]),
    });
  }
  await downloadScopedStatementPdf({
    meta,
    title: "Expense statement",
    filePrefix: "expense-statement",
    summaryHeaders: ["Total expenses", "Categories", "Transactions"],
    summaryRow: [
      money(meta.currency, totalExpenses),
      String(data.expenses.length),
      String(totalCount),
    ],
    tables,
  });
}

export async function downloadFinanceIncomeStatementPdf(
  meta: ReportExportMeta,
  data: {
    pnl: PnlRow[];
    incomeByProject?: IncomeDimensionRow[];
    incomeTransactions?: Array<{
      date: string;
      amount: number;
      description: string;
      category: string;
    }>;
    kpis?: Pick<FinanceReportKpis, "totalInvoiced" | "totalCollected">;
  },
) {
  const invoiced =
    data.kpis?.totalInvoiced ??
    data.pnl.reduce((sum, row) => sum + row.invoiced, 0);
  const collected =
    data.kpis?.totalCollected ??
    data.pnl.reduce((sum, row) => sum + row.collected, 0);
  const tables: ScopedTable[] = [
    {
      title: "Income by month",
      headers: ["Month", "Invoiced", "Collected"],
      rows: data.pnl.map((row) => [
        row.month,
        money(meta.currency, row.invoiced),
        money(meta.currency, row.collected),
      ]),
    },
  ];
  if (data.incomeByProject?.length) {
    tables.push({
      title: "Collected by project / room",
      headers: ["Project / room", "Collected", "Deposits", "Short let", "Other"],
      rows: data.incomeByProject.map((row) => [
        row.label,
        money(meta.currency, row.collected),
        money(meta.currency, row.deposits),
        money(meta.currency, row.shortlet),
        money(meta.currency, row.other),
      ]),
    });
  }
  if (data.incomeTransactions?.length) {
    tables.push({
      title: "Collection transactions",
      headers: ["Date", "Category", "Description", "Amount"],
      rows: data.incomeTransactions.slice(0, 120).map((row) => [
        row.date,
        row.category,
        row.description,
        money(meta.currency, row.amount),
      ]),
    });
  }
  await downloadScopedStatementPdf({
    meta,
    title: "Income / collections statement",
    filePrefix: "income-statement",
    summaryHeaders: ["Invoiced", "Collected"],
    summaryRow: [money(meta.currency, invoiced), money(meta.currency, collected)],
    tables,
  });
}

export async function downloadFinanceRemittanceStatementPdf(
  meta: ReportExportMeta,
  data: {
    pnl: PnlRow[];
    remittanceBreakdown: Array<{ label: string; count: number; total: number }>;
    remittanceTransactions?: Array<{
      date: string;
      amount: number;
      description: string;
      category: string;
    }>;
    kpis?: Pick<FinanceReportKpis, "totalRemitted">;
  },
) {
  const remitted =
    data.kpis?.totalRemitted ??
    data.remittanceBreakdown.reduce((sum, row) => sum + row.total, 0);
  const tables: ScopedTable[] = [
    {
      title: "Remitted by month",
      headers: ["Month", "Remitted"],
      rows: data.pnl.map((row) => [
        row.month,
        money(meta.currency, Number(row.remitted || 0)),
      ]),
    },
    {
      title: "Remitted by client",
      headers: ["Client", "Payments", "Total"],
      rows: data.remittanceBreakdown.map((row) => [
        row.label,
        String(row.count),
        money(meta.currency, row.total),
      ]),
    },
  ];
  if (data.remittanceTransactions?.length) {
    tables.push({
      title: "Remittance transactions",
      headers: ["Date", "Client", "Description", "Amount"],
      rows: data.remittanceTransactions.slice(0, 120).map((row) => [
        row.date,
        row.category,
        row.description,
        money(meta.currency, row.amount),
      ]),
    });
  }
  await downloadScopedStatementPdf({
    meta,
    title: "Remittance statement",
    filePrefix: "remittance-statement",
    summaryHeaders: ["Total remitted", "Clients"],
    summaryRow: [
      money(meta.currency, remitted),
      String(data.remittanceBreakdown.length),
    ],
    tables,
  });
}

export async function downloadFinanceReceivablesStatementPdf(
  meta: ReportExportMeta,
  data: {
    receivableRows: Array<{
      invoiceNumber: string;
      customerName: string;
      dueDate: string;
      status: string;
      balance: number;
      overdueDays: number;
    }>;
    kpis?: Pick<FinanceReportKpis, "receivables" | "overdueReceivables">;
  },
) {
  const open =
    data.kpis?.receivables ??
    data.receivableRows.reduce((sum, row) => sum + row.balance, 0);
  const overdue =
    data.kpis?.overdueReceivables ??
    data.receivableRows
      .filter((row) => row.overdueDays > 0)
      .reduce((sum, row) => sum + row.balance, 0);
  await downloadScopedStatementPdf({
    meta,
    title: "Receivables statement",
    filePrefix: "receivables-statement",
    summaryHeaders: ["Open receivables", "Overdue", "Open invoices"],
    summaryRow: [
      money(meta.currency, open),
      money(meta.currency, overdue),
      String(data.receivableRows.length),
    ],
    tables: [
      {
        title: "Open invoices",
        headers: ["Invoice", "Customer", "Due", "Status", "Balance", "Overdue days"],
        rows: data.receivableRows.slice(0, 120).map((row) => [
          row.invoiceNumber,
          row.customerName,
          row.dueDate,
          row.status,
          money(meta.currency, row.balance),
          String(row.overdueDays),
        ]),
      },
    ],
  });
}
