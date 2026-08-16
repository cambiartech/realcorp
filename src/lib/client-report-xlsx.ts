import ExcelJS from "exceljs";
import {
  addKpiCards,
  addReportBanner,
  addStyledDataTable,
  downloadWorkbook,
} from "@/lib/report-xlsx-theme";

export type ClientExportRow = {
  fullName: string;
  email: string;
  phone: string;
  status: string;
  unitsCount: number;
  paid: number;
  remaining: number;
  createdAtLabel: string;
};

export type ClientUnitBalanceExportRow = {
  clientName: string;
  projectLabel: string;
  unitLabel: string;
  contractValue: number;
  collected: number;
  remaining: number;
};

export async function downloadClientPortfolioXlsx(input: {
  companyName: string;
  currency: string;
  clients: ClientExportRow[];
  unitBalances: ClientUnitBalanceExportRow[];
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Realcorp";
  workbook.created = new Date();
  const generatedAtLabel = new Date().toLocaleString("en-NG");
  const stamp = new Date().toISOString().slice(0, 10);
  const totalPaid = input.clients.reduce((sum, row) => sum + row.paid, 0);
  const totalRemaining = input.clients.reduce((sum, row) => sum + row.remaining, 0);
  const totalContract = input.unitBalances.reduce((sum, row) => sum + row.contractValue, 0);

  const summary = workbook.addWorksheet("Summary");
  addReportBanner(
    summary,
    {
      title: "Client portfolio",
      companyName: input.companyName,
      generatedAtLabel,
      currency: input.currency,
      subtitle: "Units, amounts paid, and remaining balances",
    },
    8,
  );
  addKpiCards(
    summary,
    5,
    [
      { label: "Clients", value: input.clients.length },
      { label: "Unit amount", value: totalContract, tone: "highlight" },
      { label: "Paid", value: totalPaid, tone: "positive" },
      { label: "Remaining", value: totalRemaining, tone: "negative" },
    ],
    input.currency,
  );

  const clientsSheet = workbook.addWorksheet("Clients");
  addReportBanner(
    clientsSheet,
    {
      title: "Clients",
      companyName: input.companyName,
      generatedAtLabel,
      currency: input.currency,
    },
    8,
  );
  addStyledDataTable(
    clientsSheet,
    ["Client", "Phone", "Email", "Status", "Units", "Paid", "Remaining", "Added"],
    input.clients.map((row) => [
      row.fullName,
      row.phone,
      row.email,
      row.status,
      row.unitsCount,
      row.paid,
      row.remaining,
      row.createdAtLabel,
    ]),
    { startRow: 5, currency: input.currency, moneyColumns: [6, 7] },
  );

  const unitsSheet = workbook.addWorksheet("Unit balances");
  addReportBanner(
    unitsSheet,
    {
      title: "Unit balances",
      companyName: input.companyName,
      generatedAtLabel,
      currency: input.currency,
      subtitle: "What each client has paid and what is left on each unit",
    },
    6,
  );
  addStyledDataTable(
    unitsSheet,
    ["Client", "Project", "Unit", "Amount", "Paid", "Remaining"],
    input.unitBalances.map((row) => [
      row.clientName,
      row.projectLabel,
      row.unitLabel,
      row.contractValue,
      row.collected,
      row.remaining,
    ]),
    { startRow: 5, currency: input.currency, moneyColumns: [4, 5, 6] },
  );

  await downloadWorkbook(workbook, `client-portfolio-${stamp}.xlsx`);
}

export async function downloadClientStatementXlsx(input: {
  companyName: string;
  currency: string;
  clientName: string;
  phone: string;
  email: string;
  status: string;
  contractValue: number;
  collected: number;
  remaining: number;
  unitBalances: ClientUnitBalanceExportRow[];
  payments: Array<{
    paidAtLabel: string;
    unitLabel: string;
    amount: number;
    method: string;
    reference: string;
  }>;
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Realcorp";
  workbook.created = new Date();
  const generatedAtLabel = new Date().toLocaleString("en-NG");
  const stamp = new Date().toISOString().slice(0, 10);
  const safeName = input.clientName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();

  const summary = workbook.addWorksheet("Summary");
  addReportBanner(
    summary,
    {
      title: `${input.clientName} — statement`,
      companyName: input.companyName,
      generatedAtLabel,
      currency: input.currency,
      subtitle: [input.phone, input.email, input.status].filter(Boolean).join(" · ") || "Client statement",
    },
    6,
  );
  addKpiCards(
    summary,
    5,
    [
      { label: "Unit amount", value: input.contractValue, tone: "highlight" },
      { label: "Paid", value: input.collected, tone: "positive" },
      { label: "Remaining", value: input.remaining, tone: "negative" },
      { label: "Payments", value: input.payments.length },
    ],
    input.currency,
  );

  const unitsSheet = workbook.addWorksheet("Units");
  addReportBanner(
    unitsSheet,
    {
      title: "Project units",
      companyName: input.companyName,
      generatedAtLabel,
      currency: input.currency,
    },
    5,
  );
  addStyledDataTable(
    unitsSheet,
    ["Project", "Unit", "Amount", "Paid", "Remaining"],
    input.unitBalances.map((row) => [
      row.projectLabel,
      row.unitLabel,
      row.contractValue,
      row.collected,
      row.remaining,
    ]),
    { startRow: 5, currency: input.currency, moneyColumns: [3, 4, 5] },
  );

  const paymentsSheet = workbook.addWorksheet("Payments");
  addReportBanner(
    paymentsSheet,
    {
      title: "Payment history",
      companyName: input.companyName,
      generatedAtLabel,
      currency: input.currency,
    },
    5,
  );
  addStyledDataTable(
    paymentsSheet,
    ["Date", "Unit", "Amount", "Method", "Reference"],
    input.payments.map((row) => [
      row.paidAtLabel,
      row.unitLabel,
      row.amount,
      row.method || "—",
      row.reference || "—",
    ]),
    { startRow: 5, currency: input.currency, moneyColumns: [3] },
  );

  await downloadWorkbook(workbook, `client-${safeName || "statement"}-${stamp}.xlsx`);
}
