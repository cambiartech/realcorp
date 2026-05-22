"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { importLeads, type ImportLeadRow } from "../actions";

// ---------------------------------------------------------------------------
// CSV parser — handles quoted fields, CRLF and LF, UTF-8 BOM
// ---------------------------------------------------------------------------
function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"' && clean[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); field = ""; rows.push(row); row = []; }
      else { field += ch; }
    }
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

// Canonical column aliases
const COL_MAP: Record<string, keyof ImportLeadRow> = {
  name: "name", "full name": "name", "lead name": "name", fullname: "name",
  email: "email", "email address": "email",
  phone: "phone", "phone number": "phone", mobile: "phone", tel: "phone",
  source: "source", "lead source": "source",
  project: "projectInterest", "project interest": "projectInterest", "project name": "projectInterest",
  budget: "budgetRange", "budget range": "budgetRange",
  campaign: "campaignName", "campaign name": "campaignName",
};

type PreviewRow = ImportLeadRow & { _valid: boolean; _errors: string[] };

type ImportState =
  | { phase: "idle" }
  | { phase: "preview"; headers: string[]; rows: PreviewRow[]; fileName: string }
  | { phase: "done"; count: number };

export function LeadImportWorkspace({ tenantSlug }: { tenantSlug: string }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [state, setState] = useState<ImportState>({ phase: "idle" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const matrix = parseCsv(text);
      if (matrix.length < 2) {
        setError("File appears empty or has only a header row.");
        return;
      }
      const rawHeaders = matrix[0].map((h) => h.trim().toLowerCase());
      const colIndex: Partial<Record<keyof ImportLeadRow, number>> = {};
      rawHeaders.forEach((h, i) => {
        const key = COL_MAP[h];
        if (key && colIndex[key] === undefined) colIndex[key] = i;
      });

      if (colIndex.name === undefined) {
        setError(`Could not find a "name" column. Found: ${matrix[0].join(", ")}`);
        return;
      }

      const preview: PreviewRow[] = matrix.slice(1).map((row) => {
        const get = (k: keyof ImportLeadRow) =>
          colIndex[k] !== undefined ? row[colIndex[k]!]?.trim() || undefined : undefined;
        const name = get("name") ?? "";
        const errors: string[] = [];
        if (!name) errors.push("Name is required");
        return {
          name,
          email: get("email"),
          phone: get("phone"),
          source: get("source"),
          projectInterest: get("projectInterest"),
          budgetRange: get("budgetRange"),
          campaignName: get("campaignName"),
          _valid: errors.length === 0,
          _errors: errors,
        };
      });

      setError(null);
      setState({
        phase: "preview",
        headers: matrix[0],
        rows: preview,
        fileName: file.name,
      });
    };
    reader.readAsText(file, "UTF-8");
  }

  async function handleImport() {
    if (state.phase !== "preview") return;
    const validRows = state.rows.filter((r) => r._valid);
    if (!validRows.length) return;
    setLoading(true);
    setError(null);
    const clean: ImportLeadRow[] = validRows.map(({ _valid: _v, _errors: _e, ...rest }) => rest);
    const result = await importLeads(tenantSlug, clean);
    setLoading(false);
    if (!result.ok) { setError(result.error); return; }
    setState({ phase: "done", count: result.count });
  }

  const validCount = state.phase === "preview" ? state.rows.filter((r) => r._valid).length : 0;
  const invalidCount = state.phase === "preview" ? state.rows.filter((r) => !r._valid).length : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/${tenantSlug}/leads`}
          className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Back to leads
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Import leads from CSV</h1>
        <p className="mt-1 text-sm text-muted">
          Upload a .csv file — we auto-detect columns. Only <strong>Name</strong> is required.
        </p>
      </div>

      {/* Column legend */}
      <div className="mb-6 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Recognised column names</p>
        <div className="flex flex-wrap gap-2">
          {[
            "Name", "Email", "Phone", "Source",
            "Project (interest)", "Budget (range)", "Campaign",
          ].map((col) => (
            <span key={col} className="rounded border border-foreground/10 bg-background px-2 py-0.5 font-mono text-xs text-foreground/80">
              {col}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Column names are case-insensitive. Extra columns are ignored. Download a{" "}
          <a
            href={`data:text/csv;charset=utf-8,Name,Email,Phone,Source,Project,Budget,Campaign\nJohn Doe,john@example.com,+234 801 000 0001,Referral,Lekki Heights,50M-100M,Q2 Campaign`}
            download="lead-import-template.csv"
            className="font-medium text-foreground underline decoration-foreground/30 underline-offset-2"
          >
            template CSV
          </a>
          .
        </p>
      </div>

      {/* Upload zone */}
      {state.phase === "idle" && (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-foreground/20 bg-foreground/[0.01] px-6 py-14 text-center transition-colors hover:border-foreground/40 hover:bg-foreground/[0.03]">
          <svg viewBox="0 0 24 24" className="h-10 w-10 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 12V4m0 0l-3 3m3-3l3 3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <p className="font-semibold text-foreground">Click to upload or drag &amp; drop</p>
            <p className="mt-1 text-sm text-muted">CSV files only · max 1 000 rows</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={handleFile}
          />
        </label>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-400/30 bg-red-500/5 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Preview */}
      {state.phase === "preview" && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">{state.fileName}</span>
              <span className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-600">
                {validCount} valid
              </span>
              {invalidCount > 0 && (
                <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                  {invalidCount} skipped
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setState({ phase: "idle" }); if (fileRef.current) fileRef.current.value = ""; }}
                className="rounded-md border border-foreground/15 px-3 py-1.5 text-sm text-muted hover:bg-foreground/[0.04] hover:text-foreground"
              >
                Change file
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={loading || validCount === 0}
                className="rounded-md border border-foreground bg-foreground px-4 py-1.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Importing…" : `Import ${validCount} leads`}
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-foreground/10">
            <div className="max-h-[480px] overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-foreground/[0.04] text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2">Budget</th>
                    <th className="px-3 py-2">Campaign</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/10">
                  {state.rows.map((row, i) => (
                    <tr key={i} className={row._valid ? "" : "bg-red-500/[0.03]"}>
                      <td className="px-3 py-2 tabular-nums text-muted">{i + 1}</td>
                      <td className="px-3 py-2">
                        {row._valid ? (
                          <span className="text-green-600">✓</span>
                        ) : (
                          <span className="text-red-500" title={row._errors.join("; ")}>
                            ✕ {row._errors.join("; ")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium text-foreground">{row.name || <span className="italic text-muted">—</span>}</td>
                      <td className="px-3 py-2 text-muted">{row.email ?? "—"}</td>
                      <td className="px-3 py-2 text-muted">{row.phone ?? "—"}</td>
                      <td className="px-3 py-2 text-muted">{row.source ?? "—"}</td>
                      <td className="px-3 py-2 text-muted">{row.projectInterest ?? "—"}</td>
                      <td className="px-3 py-2 text-muted">{row.budgetRange ?? "—"}</td>
                      <td className="px-3 py-2 text-muted">{row.campaignName ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Success */}
      {state.phase === "done" && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-green-400/30 bg-green-500/5 px-8 py-14 text-center">
          <svg viewBox="0 0 24 24" className="h-12 w-12 text-green-500" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <p className="text-xl font-bold text-foreground">{state.count} leads imported!</p>
            <p className="mt-1 text-sm text-muted">
              Scores will be calculated automatically in the background.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/${tenantSlug}/leads`}
              className="rounded-md border border-foreground bg-foreground px-5 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
            >
              View leads
            </Link>
            <button
              type="button"
              onClick={() => { setState({ phase: "idle" }); if (fileRef.current) fileRef.current.value = ""; }}
              className="rounded-md border border-foreground/15 px-5 py-2 text-sm font-medium text-muted hover:bg-foreground/[0.04] hover:text-foreground"
            >
              Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
