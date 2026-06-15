"use client";

import { useState } from "react";
import { downloadCsv, downloadExcel, downloadPdfViaPrint, type ExportRow } from "@/lib/table-export";

type Props = {
  filename: string;
  sheetName?: string;
  headers: string[];
  keys: string[];
  rows: ExportRow[];
  showPdf?: boolean;
  className?: string;
};

export function DataExportMenu({
  filename,
  sheetName = "Export",
  headers,
  keys,
  rows,
  showPdf = true,
  className,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function exportExcel() {
    setBusy(true);
    try {
      await downloadExcel(filename, sheetName, headers, rows, keys);
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
      >
        Export CSV
      </button>
      <button
        type="button"
        disabled={busy || rows.length === 0}
        onClick={() => void exportExcel()}
        className="rounded-md border border-foreground/15 px-3 py-1.5 text-sm hover:bg-foreground/[0.06] disabled:opacity-50"
      >
        Export Excel
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
