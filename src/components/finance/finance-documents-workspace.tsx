"use client";

import Link from "next/link";

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
              {documents.map((doc) => (
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
    </div>
  );
}
