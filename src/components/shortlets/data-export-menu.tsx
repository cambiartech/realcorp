"use client";

import { useState } from "react";
import { downloadModuleReportXlsx, type ModuleReportBreakdown } from "@/lib/module-report-xlsx";
import { downloadPdfViaPrint, downloadCsv, type ExportRow } from "@/lib/table-export";
import type { KpiItem } from "@/lib/report-xlsx-theme";

type Props = {
  filename: string;
  sheetName?: string;
  headers: string[];
  keys: string[];
  rows: ExportRow[];
  showPdf?: boolean;
  className?: string;
  /** Branded Excel summary — company name, KPIs, breakdown charts */
  reportTitle?: string;
  companyName?: string;
  periodLabel?: string;
  currency?: string;
  kpis?: KpiItem[];
  breakdowns?: ModuleReportBreakdown[];
};

export function DataExportMenu({
  filename,
  sheetName = "Export",
  headers,
  keys,
  rows,
  showPdf = true,
  className,
  reportTitle,
  companyName = "Report",
  periodLabel,
  currency,
  kpis,
  breakdowns,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function exportExcel() {
    setBusy(true);
    try {
      const stamp = new Date().toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
      await downloadModuleReportXlsx({
        filename,
        meta: {
          title: reportTitle || sheetName,
          companyName,
          generatedAtLabel: stamp,
          periodLabel,
          currency,
        },
        kpis,
        breakdowns,
        currency,
        dataSheetName: sheetName,
        headers,
        keys,
        rows,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={["flex flex-wrap gap-2", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        disabled={busy || rows.length === 0}
        onClick={() => downloadCsv(filename, headers, rows, keys)}
        className="rounded-md border border-foreground/15 px-3 py-1.5 text-sm hover:bg-foreground/[0.06] disabled:opacity-50"
        title="Raw data for imports — use Excel for meeting-ready reports with charts"
      >
        Export CSV
      </button>
      <button
        type="button"
        disabled={busy || rows.length === 0}
        onClick={() => void exportExcel()}
        className="rounded-md border border-foreground bg-foreground px-3 py-1.5 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Building…" : "Export Excel"}
      </button>
      {showPdf ? (
        <button
          type="button"
          onClick={downloadPdfViaPrint}
          className="rounded-md border border-foreground/15 px-3 py-1.5 text-sm hover:bg-foreground/[0.06]"
        >
          Export PDF
        </button>
      ) : null}
    </div>
  );
}
