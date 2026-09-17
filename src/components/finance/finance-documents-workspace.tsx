"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { UiSelect } from "@/components/ui-select";

const inputClass =
  "w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20";

export function FinanceDocumentsWorkspace({
  tenantSlug,
  documents,
}: {
  tenantSlug: string;
  documents: Array<{
    id: string;
    title: string;
    category: string;
    fileUrl: string;
    fileName: string | null;
    createdAtLabel: string;
    receiptNumber: string | null;
  }>;
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");

  const categories = useMemo(
    () =>
      Array.from(new Set(documents.map((d) => d.category).filter(Boolean))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [documents],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return documents.filter((doc) => {
      if (category !== "all" && doc.category !== category) return false;
      if (!needle) return true;
      return [doc.title, doc.category, doc.fileName, doc.receiptNumber]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [documents, q, category]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Finance documents</h1>
        <p className="mt-1 text-sm text-muted">
          Org copies of receipts and invoices — auto-filed when you email them from Finance.
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-foreground/20 px-6 py-12 text-center text-sm text-muted">
          No documents yet. Send a sales receipt or invoice by email — the PDF is saved here automatically.
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-foreground/10 bg-foreground/[0.015] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Search & filter</p>
              {q || category !== "all" ? (
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    setCategory("all");
                  }}
                  className="text-xs font-semibold underline decoration-foreground/25 underline-offset-2"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="relative block sm:col-span-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search title, file, receipt…"
                  className={`${inputClass} pl-9`}
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
                  Category
                </span>
                <UiSelect
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="all">All categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </UiSelect>
              </label>
            </div>
            <p className="mt-2 text-xs text-muted">
              Showing {filtered.length} of {documents.length}.
            </p>
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted">No documents match these filters.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-foreground/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3">Document</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Added</th>
                    <th className="px-4 py-3">File</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/10">
                  {filtered.map((doc) => (
                    <tr key={doc.id} className="hover:bg-foreground/[0.02]">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{doc.title}</p>
                        {doc.receiptNumber ? (
                          <Link
                            href={`/${tenantSlug}/finance/sales-receipts?focus=${doc.receiptNumber}`}
                            className="text-xs text-muted underline"
                          >
                            View receipt
                          </Link>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted">{doc.category}</td>
                      <td className="px-4 py-3 text-muted">{doc.createdAtLabel}</td>
                      <td className="px-4 py-3">
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-foreground underline"
                        >
                          {doc.fileName || "Open PDF"}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
