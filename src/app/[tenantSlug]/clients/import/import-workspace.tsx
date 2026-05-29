"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ButtonSpinner } from "@/components/button-spinner";
import { importClients, type ImportClientRow } from "../actions";

function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

const COL_MAP: Record<string, keyof ImportClientRow> = {
  name: "fullName",
  "full name": "fullName",
  "client name": "fullName",
  fullname: "fullName",
  client: "fullName",
  email: "email",
  "email address": "email",
  phone: "phone",
  "phone number": "phone",
  mobile: "phone",
  tel: "phone",
  "alternate phone": "alternatePhone",
  "alt phone": "alternatePhone",
  address: "addressLine",
  "address line": "addressLine",
  city: "city",
  state: "state",
  country: "country",
  status: "status",
  notes: "notes",
  project: "projectName",
  "project name": "projectName",
  unit: "unitLabel",
  "unit label": "unitLabel",
  "pricing plan": "pricingPlanName",
  plan: "pricingPlanName",
  role: "unitRole",
  "unit role": "unitRole",
};

type PreviewRow = ImportClientRow & { _valid: boolean; _errors: string[] };

type ImportState =
  | { phase: "idle" }
  | { phase: "preview"; headers: string[]; rows: PreviewRow[]; fileName: string }
  | { phase: "done"; count: number; unitsLinked: number; unitLinkSkipped: number };

export function ClientImportWorkspace({ tenantSlug }: { tenantSlug: string }) {
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
      const colIndex: Partial<Record<keyof ImportClientRow, number>> = {};
      rawHeaders.forEach((h, i) => {
        const key = COL_MAP[h];
        if (key && colIndex[key] === undefined) colIndex[key] = i;
      });

      if (colIndex.fullName === undefined) {
        setError(`Could not find a "name" column. Found: ${matrix[0].join(", ")}`);
        return;
      }

      const preview: PreviewRow[] = matrix.slice(1).map((row) => {
        const get = (k: keyof ImportClientRow) =>
          colIndex[k] !== undefined ? row[colIndex[k]!]?.trim() || undefined : undefined;
        const fullName = get("fullName") ?? "";
        const errors: string[] = [];
        if (!fullName) errors.push("Name is required");
        return {
          fullName,
          email: get("email"),
          phone: get("phone"),
          alternatePhone: get("alternatePhone"),
          addressLine: get("addressLine"),
          city: get("city"),
          state: get("state"),
          country: get("country"),
          status: get("status"),
          notes: get("notes"),
          projectName: get("projectName"),
          unitLabel: get("unitLabel"),
          pricingPlanName: get("pricingPlanName"),
          unitRole: get("unitRole"),
          _valid: errors.length === 0,
          _errors: errors,
        };
      });

      setError(null);
      setState({ phase: "preview", headers: matrix[0], rows: preview, fileName: file.name });
    };
    reader.readAsText(file, "UTF-8");
  }

  async function handleImport() {
    if (state.phase !== "preview") return;
    const validRows = state.rows.filter((r) => r._valid);
    if (!validRows.length) return;
    setLoading(true);
    setError(null);
    const clean: ImportClientRow[] = validRows.map(({ _valid: _v, _errors: _e, ...rest }) => rest);
    const result = await importClients(tenantSlug, clean);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setState({
      phase: "done",
      count: result.count,
      unitsLinked: result.unitsLinked,
      unitLinkSkipped: result.unitLinkSkipped,
    });
  }

  const validCount = state.phase === "preview" ? state.rows.filter((r) => r._valid).length : 0;
  const invalidCount = state.phase === "preview" ? state.rows.filter((r) => !r._valid).length : 0;

  const templateCsv =
    "Name,Email,Phone,Status,Address,City,State,Project,Unit,Pricing Plan,Role,Notes\n" +
    "Adebayo Okonkwo,ade@example.com,+2348010000001,ACTIVE,12 Admiralty Way,Lekki,Lagos,BO Gardens,A-12,Studio unit 1,Owner,Existing portfolio import";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <Link href={`/${tenantSlug}/clients`} className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground">
          ← Back to clients
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Import clients from CSV</h1>
        <p className="mt-1 text-sm text-muted">
          Bring in existing property owners and investors. Only <strong>Name</strong> is required — optionally include
          project, unit, and pricing plan to link holdings in one go.
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Recognised columns</p>
        <div className="flex flex-wrap gap-2">
          {[
            "Name",
            "Email",
            "Phone",
            "Status",
            "Address",
            "City",
            "State",
            "Project",
            "Unit",
            "Pricing Plan",
            "Role",
            "Notes",
          ].map((col) => (
            <span key={col} className="rounded border border-foreground/10 bg-background px-2 py-0.5 font-mono text-xs">
              {col}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Status: Prospect, Active, or Former. Role: Owner, Co-owner, Investor, Tenant, Beneficiary.{" "}
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(templateCsv)}`}
            download="client-import-template.csv"
            className="font-medium text-foreground underline decoration-foreground/30 underline-offset-2"
          >
            Download template CSV
          </a>
        </p>
      </div>

      {state.phase === "idle" && (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-foreground/20 bg-foreground/[0.01] px-6 py-14 text-center transition-colors hover:border-foreground/40 hover:bg-foreground/[0.03]">
          <p className="font-semibold text-foreground">Click to upload or drag &amp; drop</p>
          <p className="text-sm text-muted">CSV only · max 1,000 rows</p>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFile} />
        </label>
      )}

      {error ? (
        <div className="mt-4 rounded-lg border border-red-400/30 bg-red-500/5 px-4 py-3 text-sm text-red-600">{error}</div>
      ) : null}

      {state.phase === "preview" && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{state.fileName}</span>
              <span className="rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-600">
                {validCount} valid
              </span>
              {invalidCount > 0 ? (
                <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                  {invalidCount} skipped
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setState({ phase: "idle" });
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="rounded-md border border-foreground/15 px-3 py-1.5 text-sm text-muted"
              >
                Change file
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={loading || validCount === 0}
                className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-1.5 text-sm font-semibold text-background disabled:opacity-50"
              >
                {loading ? <ButtonSpinner /> : null}
                {loading ? "Importing…" : `Import ${validCount} clients`}
              </button>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-foreground/10">
            <div className="max-h-[480px] overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-foreground/[0.04] text-[11px] uppercase text-muted">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Phone</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2">Unit</th>
                    <th className="px-3 py-2">Plan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/10">
                  {state.rows.map((row, i) => (
                    <tr key={i} className={row._valid ? "" : "bg-red-500/[0.03]"}>
                      <td className="px-3 py-2 text-muted">{i + 1}</td>
                      <td className="px-3 py-2">{row._valid ? "✓" : row._errors.join("; ")}</td>
                      <td className="px-3 py-2 font-medium">{row.fullName || "—"}</td>
                      <td className="px-3 py-2 text-muted">{row.phone ?? "—"}</td>
                      <td className="px-3 py-2 text-muted">{row.email ?? "—"}</td>
                      <td className="px-3 py-2 text-muted">{row.projectName ?? "—"}</td>
                      <td className="px-3 py-2 text-muted">{row.unitLabel ?? "—"}</td>
                      <td className="px-3 py-2 text-muted">{row.pricingPlanName ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {state.phase === "done" && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-green-400/30 bg-green-500/5 px-8 py-14 text-center">
          <p className="text-xl font-bold">{state.count} clients imported</p>
          <p className="text-sm text-muted">
            {state.unitsLinked} unit link(s) created
            {state.unitLinkSkipped > 0 ? ` · ${state.unitLinkSkipped} row(s) could not match project/unit` : ""}
          </p>
          <div className="flex gap-3">
            <Link
              href={`/${tenantSlug}/clients`}
              className="rounded-md border border-foreground bg-foreground px-5 py-2 text-sm font-semibold text-background"
            >
              View clients
            </Link>
            <button
              type="button"
              onClick={() => {
                setState({ phase: "idle" });
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="rounded-md border border-foreground/15 px-5 py-2 text-sm"
            >
              Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
