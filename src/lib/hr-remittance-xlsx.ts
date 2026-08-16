import ExcelJS from "exceljs";
import {
  addKpiCards,
  addReportBanner,
  addStyledDataTable,
  downloadWorkbook,
} from "@/lib/report-xlsx-theme";
import type { RemittanceSchedule } from "@/lib/hr-remittances";

function sheetName(title: string) {
  return title.slice(0, 31);
}

function addScheduleSheet(
  workbook: ExcelJS.Workbook,
  companyName: string,
  generatedAtLabel: string,
  currency: string,
  periodLabel: string,
  schedule: RemittanceSchedule,
  identityHeader: string,
) {
  const sheet = workbook.addWorksheet(sheetName(schedule.title));
  addReportBanner(
    sheet,
    {
      title: schedule.title,
      companyName,
      generatedAtLabel,
      currency,
      subtitle: `${periodLabel} · File with ${schedule.agency}`,
    },
    6,
  );
  addStyledDataTable(
    sheet,
    ["Employee", "Department", identityHeader, "Administrator", "Employee", "Employer", "Total"],
    schedule.rows.map((row) => [
      row.employeeName,
      row.department || "—",
      schedule.kind === "PAYE"
        ? row.taxId || "—"
        : schedule.kind === "PENSION"
          ? row.rsaPin || "—"
          : schedule.kind === "NHF"
            ? row.nhfMembershipNumber || "—"
            : "—",
      schedule.kind === "PENSION" ? row.pensionAdministrator || "—" : schedule.agency,
      row.employeeAmount,
      row.employerAmount,
      row.total,
    ]),
    { startRow: 5, currency, moneyColumns: [5, 6, 7] },
  );
}

export async function downloadRemittanceSchedulesXlsx(input: {
  companyName: string;
  currency: string;
  periodLabel: string;
  paye: RemittanceSchedule;
  pension: RemittanceSchedule;
  nhf: RemittanceSchedule;
  nsitf: RemittanceSchedule;
  grandTotal: number;
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Realcorp";
  workbook.created = new Date();
  const generatedAtLabel = new Date().toLocaleString("en-NG");
  const stamp = new Date().toISOString().slice(0, 10);

  const summary = workbook.addWorksheet("Summary");
  addReportBanner(
    summary,
    {
      title: "Statutory remittances",
      companyName: input.companyName,
      generatedAtLabel,
      currency: input.currency,
      subtitle: `${input.periodLabel} — PAYE, pension, NHF, and NSITF to file`,
    },
    8,
  );
  addKpiCards(
    summary,
    5,
    [
      { label: "PAYE", value: input.paye.total, tone: "highlight" },
      { label: "Pension", value: input.pension.total, tone: "positive" },
      { label: "NHF", value: input.nhf.total },
      { label: "NSITF", value: input.nsitf.total },
    ],
    input.currency,
  );

  addScheduleSheet(workbook, input.companyName, generatedAtLabel, input.currency, input.periodLabel, input.paye, "TIN");
  addScheduleSheet(workbook, input.companyName, generatedAtLabel, input.currency, input.periodLabel, input.pension, "RSA PIN");
  addScheduleSheet(workbook, input.companyName, generatedAtLabel, input.currency, input.periodLabel, input.nhf, "NHF number");
  addScheduleSheet(workbook, input.companyName, generatedAtLabel, input.currency, input.periodLabel, input.nsitf, "Reference");

  await downloadWorkbook(
    workbook,
    `remittances-${input.periodLabel.replace(/\s+/g, "-").toLowerCase()}-${stamp}.xlsx`,
  );
}
