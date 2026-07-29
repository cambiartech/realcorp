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
    /* Exports are a secondary concern — grouped as one segmented control so
       they stop competing with the page's real primary action. */
    <div
      className={[
        "inline-flex overflow-hidden rounded-[var(--r-sm)] border border-[var(--border-strong)]",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="group"
      aria-label="Export"
    >
      <button
        type="button"
        disabled={busy || rows.length === 0}
        onClick={() => downloadCsv(filename, headers, rows, keys)}
        className="rc-btn rc-btn-ghost rc-btn-sm rounded-none border-r border-[var(--border-subtle)]"
        title="Raw data for imports — use Excel for meeting-ready reports with charts"
      >
        CSV
      </button>
      <button
        type="button"
        disabled={busy || rows.length === 0}
        onClick={() => void exportExcel()}
        className="rc-btn rc-btn-ghost rc-btn-sm rounded-none font-semibold text-foreground"
        title="Formatted report with charts"
      >
        {busy ? "Building…" : "Excel"}
      </button>
      {showPdf ? (
        <button
          type="button"
          onClick={downloadPdfViaPrint}
          className="rc-btn rc-btn-ghost rc-btn-sm rounded-none border-l border-[var(--border-subtle)]"
        >
          PDF
        </button>
      ) : null}
    </div>
  );
}
