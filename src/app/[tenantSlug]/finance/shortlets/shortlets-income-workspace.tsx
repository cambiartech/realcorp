"use client";

import { useState } from "react";
import { downloadModuleReportXlsx } from "@/lib/module-report-xlsx";
import type { ShortletIncomeReport } from "@/lib/shortlet-income-report";

const INCOME_TABS = [
  { id: "project" as const, label: "By sales project" },
  { id: "property" as const, label: "By short-let property" },
  { id: "apartment" as const, label: "By apartment" },
  { id: "payments" as const, label: "Recent payments" },
];

type IncomeTab = (typeof INCOME_TABS)[number]["id"];

function moneyLabel(currency: string, value: number) {
  return `${currency} ${value.toLocaleString("en-NG")}`;
}

export function ShortletsIncomeWorkspace({
  companyName,
  currency,
  report,
}: {
  tenantSlug: string;
  companyName: string;
  currency: string;
  report: ShortletIncomeReport;
}) {
  const [exporting, setExporting] = useState(false);
  const [tab, setTab] = useState<IncomeTab>("project");

  async function exportExcel() {
    setExporting(true);
    try {
      await downloadModuleReportXlsx({
        filename: `shortlet-income-${new Date().toISOString().slice(0, 10)}.xlsx`,
        meta: {
          title: "Income per project and shortlet",
          companyName,
          generatedAtLabel: new Date().toLocaleString("en-NG"),
          currency,
          subtitle: "All money collected in the Short Lets module",
        },
        currency,
        kpis: [
          { label: "Collected", value: report.collected, tone: "positive" },
          { label: "Outstanding", value: report.outstanding, tone: "negative" },
          { label: "Folio charges", value: report.folioCharges },
          { label: "Synced to Finance", value: report.financeSynced, tone: "highlight" },
        ],
        breakdowns: [
          { title: "By sales project", rows: report.byProject.map((row) => ({ label: row.label, value: row.collected })) },
          { title: "By short-let property", rows: report.byProperty.map((row) => ({ label: row.label, value: row.collected })) },
          { title: "By apartment", rows: report.byApartment.map((row) => ({ label: row.label, value: row.collected })) },
        ],
        dataSheetName: "Payments",
        headers: ["Date", "Guest", "Property", "Apartment", "Project", "Amount", "Method", "In Finance"],
        keys: ["paidAtLabel", "guestName", "propertyLabel", "apartmentLabel", "projectLabel", "amount", "method", "synced"],
        rows: report.payments.map((row) => ({
          ...row,
          synced: row.synced ? "Yes" : "No",
        })),
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Finance</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Income per project and shortlet</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Every collection from the Short Lets module — by sales project, property, and apartment.
            Payments already posted to Finance are marked as synced.
          </p>
        </div>
        <button
          type="button"
          disabled={exporting}
          onClick={() => void exportExcel()}
          className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
        >
          {exporting ? "Preparing…" : "Export Excel"}
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Collected" value={moneyLabel(currency, report.collected)} />
        <Kpi label="Outstanding stays" value={moneyLabel(currency, report.outstanding)} />
        <Kpi label="Folio charges" value={moneyLabel(currency, report.folioCharges)} />
        <Kpi label="Synced to Finance" value={moneyLabel(currency, report.financeSynced)} />
      </div>

      <div className="mt-6 flex flex-wrap gap-1 border-b border-foreground/10 pb-2">
        {INCOME_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={[
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
              tab === item.id
                ? "bg-foreground text-background"
                : "text-muted hover:bg-foreground/[0.06] hover:text-foreground",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "project" ? (
        <IncomeTable
          title="By sales project"
          empty="No short-let payments are linked to a sales project yet."
          currency={currency}
          rows={report.byProject}
        />
      ) : tab === "property" ? (
        <IncomeTable
          title="By short-let property"
          empty="No short-let property collections yet."
          currency={currency}
          rows={report.byProperty}
        />
      ) : tab === "apartment" ? (
        <IncomeTable
          title="By apartment"
          empty="No apartment collections yet."
          currency={currency}
          rows={report.byApartment}
        />
      ) : (
        <section className="mt-4 overflow-hidden rounded-lg border border-foreground/10">
          <div className="border-b border-foreground/10 px-4 py-3">
            <h2 className="text-sm font-semibold">Recent short-let payments</h2>
          </div>
          {report.payments.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No short-let payments recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-foreground/[0.03] text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Guest</th>
                    <th className="px-4 py-2">Property / apartment</th>
                    <th className="px-4 py-2">Project</th>
                    <th className="px-4 py-2">Amount</th>
                    <th className="px-4 py-2">Finance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/10">
                  {report.payments.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 text-muted">{row.paidAtLabel}</td>
                      <td className="px-4 py-3 font-medium">{row.guestName}</td>
                      <td className="px-4 py-3">
                        <p>{row.apartmentLabel}</p>
                        <p className="text-xs text-muted">{row.propertyLabel}</p>
                      </td>
                      <td className="px-4 py-3 text-muted">{row.projectLabel}</td>
                      <td className="px-4 py-3 font-semibold">{moneyLabel(currency, row.amount)}</td>
                      <td className="px-4 py-3 text-xs">{row.synced ? "Synced" : "Not synced"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-foreground/10 p-4">
      <p className="text-xs uppercase text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function IncomeTable({
  title,
  empty,
  currency,
  rows,
}: {
  title: string;
  empty: string;
  currency: string;
  rows: ShortletIncomeReport["byProject"];
}) {
  return (
    <section className="mt-4 overflow-hidden rounded-lg border border-foreground/10">
      <div className="border-b border-foreground/10 px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">{empty}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="bg-foreground/[0.03] text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Collected</th>
              <th className="px-4 py-2">Outstanding</th>
              <th className="px-4 py-2">Stays</th>
              <th className="px-4 py-2">In Finance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/10">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-medium">{row.label}</td>
                <td className="px-4 py-3">{moneyLabel(currency, row.collected)}</td>
                <td className="px-4 py-3">{moneyLabel(currency, row.outstanding)}</td>
                <td className="px-4 py-3 text-muted">{row.reservations}</td>
                <td className="px-4 py-3">{moneyLabel(currency, row.financeSynced)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
