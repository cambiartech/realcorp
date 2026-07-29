"use client";

import Link from "next/link";
import { ChevronRight, File, FileImage, FileText } from "lucide-react";
import type { InvestorClientDocument } from "@/lib/portal";

function fileKind(fileName: string): "pdf" | "image" | "other" {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|gif|webp)$/i.test(lower)) return "image";
  return "other";
}

function FileIcon({ fileName, className }: { fileName: string; className?: string }) {
  const kind = fileKind(fileName);
  if (kind === "pdf") return <FileText className={className} strokeWidth={1.5} />;
  if (kind === "image") return <FileImage className={className} strokeWidth={1.5} />;
  return <File className={className} strokeWidth={1.5} />;
}

export function InvestorDocumentsWorkspace({
  tenantSlug,
  tenantName,
  documents,
  isAdminViewer,
}: {
  tenantSlug: string;
  tenantName: string;
  documents: InvestorClientDocument[];
  isAdminViewer?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Documents</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">My documents</h1>
        <p className="mt-2 text-sm text-muted">
          Files shared with you by {tenantName}. Only documents your property manager has approved appear
          here.
        </p>
        <Link
          href={`/${tenantSlug}/portal`}
          className="mt-3 inline-block text-sm text-muted underline decoration-foreground/30 hover:text-foreground"
        >
          ← Back to portfolio
        </Link>
      </div>

      {isAdminViewer ? (
        <div className="mb-4 rounded-xl border border-foreground/10 bg-foreground/[0.03] px-4 py-3 text-sm text-muted">
          Admin preview — upload documents from <strong className="text-foreground">Clients</strong> and
          toggle <strong className="text-foreground">Share in portal</strong> so investors see them here.
        </div>
      ) : null}

      {documents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-foreground/15 px-6 py-14 text-center">
          <p className="text-sm font-medium text-foreground">No documents shared yet</p>
          <p className="mt-1 text-sm text-muted">
            When your property manager uploads a document and enables portal sharing, it will show up here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-3 bg-background px-4 py-3 hover:bg-foreground/[0.02]"
            >
              <FileIcon fileName={doc.fileName} className="h-8 w-8 text-muted" />
              <div className="min-w-0 flex-1">
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-foreground hover:underline"
                >
                  {doc.title}
                </a>
                <p className="text-xs text-muted">
                  {doc.category} · {doc.uploadedAtLabel}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
