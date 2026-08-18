"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, File, FileImage, FileText, Folder, FolderOpen, HardDrive, Users } from "lucide-react";
import { FileDropZone } from "@/components/hr/file-drop-zone";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { SearchableSelect } from "@/components/searchable-select";
import {
  addClientDocument,
  getClientUploadSignature,
  setClientDocumentPortalVisibility,
} from "@/app/[tenantSlug]/clients/actions";
import { uploadViaCloudinarySignature } from "@/lib/cloudinary-upload-client";

const DOC_CATEGORIES = [
  { value: "ID", label: "ID & KYC" },
  { value: "PURCHASE_AGREEMENT", label: "Purchase agreements" },
  { value: "ALLOCATION_LETTER", label: "Allocation letters" },
  { value: "RECEIPT", label: "Receipts" },
  { value: "DEED", label: "Deeds & titles" },
  { value: "TENANCY", label: "Tenancy" },
  { value: "CORRESPONDENCE", label: "Correspondence" },
  { value: "OTHER", label: "Other" },
] as const;

type BrowseMode = "type" | "client";

export type ClientDocumentItem = {
  id: string;
  clientId: string;
  clientName: string;
  category: string;
  categoryValue: string;
  title: string;
  fileUrl: string;
  fileName: string;
  uploadedAtLabel: string;
  visibleInPortal: boolean;
};

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

export function ClientDocumentsWorkspace({
  tenantSlug,
  canManage,
  clients,
  documents,
  preselectClientId,
}: {
  tenantSlug: string;
  canManage: boolean;
  clients: Array<{ id: string; fullName: string }>;
  documents: ClientDocumentItem[];
  preselectClientId?: string;
}) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [browseMode, setBrowseMode] = useState<BrowseMode>(preselectClientId ? "client" : "type");
  const [selectedTypeFolder, setSelectedTypeFolder] = useState("ALL");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(preselectClientId ?? null);
  const [uploadClientId, setUploadClientId] = useState(preselectClientId ?? "");
  const [uploadCategory, setUploadCategory] = useState("PURCHASE_AGREEMENT");
  const [uploadTitle, setUploadTitle] = useState("");
  const [shareInPortal, setShareInPortal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [togglingDocId, setTogglingDocId] = useState<string | null>(null);
  const [showUploadPanel, setShowUploadPanel] = useState(Boolean(preselectClientId));

  useEffect(() => {
    if (!preselectClientId) return;
    setBrowseMode("client");
    setSelectedClientId(preselectClientId);
    setUploadClientId(preselectClientId);
    setShowUploadPanel(true);
  }, [preselectClientId]);

  const countByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of documents) m.set(d.categoryValue, (m.get(d.categoryValue) ?? 0) + 1);
    return m;
  }, [documents]);

  const countByClient = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of documents) m.set(d.clientId, (m.get(d.clientId) ?? 0) + 1);
    return m;
  }, [documents]);

  const selectedClient = useMemo(
    () => (selectedClientId ? clients.find((c) => c.id === selectedClientId) : null),
    [selectedClientId, clients],
  );

  const visibleDocuments = useMemo(() => {
    if (browseMode === "type") {
      if (selectedTypeFolder === "ALL") return documents;
      return documents.filter((d) => d.categoryValue === selectedTypeFolder);
    }
    if (!selectedClientId) return documents;
    return documents.filter((d) => d.clientId === selectedClientId);
  }, [browseMode, selectedTypeFolder, selectedClientId, documents]);

  async function uploadFile(file: File) {
    if (!canManage) return;
    if (!uploadClientId) {
      showSnackbar("Select which client this document belongs to.", "error");
      return;
    }
    const title = uploadTitle.trim() || file.name.replace(/\.[^/.]+$/, "");
    setUploading(true);
    const sig = await getClientUploadSignature(tenantSlug, { fileName: file.name });
    if (!sig.ok) {
      showSnackbar(sig.error, "error");
      setUploading(false);
      return;
    }
    const uploaded = await uploadViaCloudinarySignature(file, sig);
    setUploading(false);
    if (!uploaded.ok) {
      showSnackbar(uploaded.error, "error");
      return;
    }
    const result = await addClientDocument(tenantSlug, {
      clientId: uploadClientId,
      category: uploadCategory,
      title,
      fileUrl: uploaded.secureUrl,
      fileName: file.name,
      visibleInPortal: shareInPortal,
    });
    if (!result.ok) {
      showSnackbar(result.error || "Could not save document.", "error");
      return;
    }
    showSnackbar(shareInPortal ? "Document uploaded and shared in portal." : "Document uploaded.", "success");
    setUploadTitle("");
    setShareInPortal(false);
    router.refresh();
  }

  async function togglePortalVisibility(doc: ClientDocumentItem) {
    setTogglingDocId(doc.id);
    const result = await setClientDocumentPortalVisibility(tenantSlug, doc.id, !doc.visibleInPortal);
    setTogglingDocId(null);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      return;
    }
    showSnackbar(doc.visibleInPortal ? "Hidden from client portal." : "Shared in client portal.", "success");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-foreground/10 p-0.5">
          <button
            type="button"
            onClick={() => {
              setBrowseMode("type");
              setSelectedClientId(null);
            }}
            className={[
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold",
              browseMode === "type" ? "bg-foreground text-background" : "text-muted",
            ].join(" ")}
          >
            <HardDrive className="h-3.5 w-3.5" />
            By folder
          </button>
          <button
            type="button"
            onClick={() => {
              setBrowseMode("client");
              setSelectedTypeFolder("ALL");
            }}
            className={[
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold",
              browseMode === "client" ? "bg-foreground text-background" : "text-muted",
            ].join(" ")}
          >
            <Users className="h-3.5 w-3.5" />
            By client
          </button>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={() => setShowUploadPanel((v) => !v)}
            className="text-xs font-semibold underline"
          >
            {showUploadPanel ? "Hide upload" : "Upload document"}
          </button>
        ) : null}
      </div>

      {canManage && showUploadPanel ? (
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
          <p className="mb-3 text-sm font-semibold">Upload client document</p>
          <div className="grid gap-4 lg:grid-cols-[1fr_minmax(220px,280px)]">
            <FileDropZone onFile={uploadFile} uploading={uploading} disabled={!uploadClientId} />
            <div className="flex flex-col gap-3">
              <label className="text-xs font-medium text-muted">Client</label>
              <SearchableSelect
                value={uploadClientId}
                onChange={setUploadClientId}
                allowEmpty
                emptyLabel="Select client…"
                searchPlaceholder="Search clients…"
                placeholder="Select client…"
                options={clients.map((c) => ({ value: c.id, label: c.fullName }))}
              />
              <label className="text-xs font-medium text-muted">Folder</label>
              <UiSelect value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
                {DOC_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </UiSelect>
              <label className="text-xs font-medium text-muted">Display name</label>
              <input
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="e.g. Signed allocation — Unit A-12"
                className="w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
              />
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={shareInPortal}
                  onChange={(e) => setShareInPortal(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium text-foreground">Share in client portal</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    Investor can view and download this file under My documents.
                  </span>
                </span>
              </label>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-[420px] overflow-hidden rounded-xl border border-foreground/10">
        <aside className="w-56 shrink-0 border-r border-foreground/10 bg-foreground/[0.03] p-2 sm:w-64">
          <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-muted">Folders</p>
          {browseMode === "type" ? (
            <ul className="space-y-0.5">
              <li>
                <button
                  type="button"
                  onClick={() => setSelectedTypeFolder("ALL")}
                  className={[
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm",
                    selectedTypeFolder === "ALL"
                      ? "bg-[var(--warn-wash)] font-semibold"
                      : "hover:bg-foreground/[0.06]",
                  ].join(" ")}
                >
                  <FolderOpen className="h-5 w-5 text-[var(--warn)]" />
                  <span className="flex-1 truncate">All documents</span>
                  <span className="text-[10px] text-muted">{documents.length}</span>
                </button>
              </li>
              {DOC_CATEGORIES.map((cat) => (
                <li key={cat.value}>
                  <button
                    type="button"
                    onClick={() => setSelectedTypeFolder(cat.value)}
                    className={[
                      "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm",
                      selectedTypeFolder === cat.value
                        ? "bg-[var(--warn-wash)] font-semibold"
                        : "hover:bg-foreground/[0.06]",
                    ].join(" ")}
                  >
                    <Folder className="h-5 w-5 text-[var(--warn)]" />
                    <span className="flex-1 truncate">{cat.label}</span>
                    <span className="text-[10px] text-muted">{countByCategory.get(cat.value) ?? 0}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-0.5">
              {clients.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClientId(c.id);
                      setUploadClientId(c.id);
                    }}
                    className={[
                      "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm",
                      selectedClientId === c.id
                        ? "bg-[var(--warn-wash)] font-semibold"
                        : "hover:bg-foreground/[0.06]",
                    ].join(" ")}
                  >
                    <Folder className="h-5 w-5 text-[var(--warn)]" />
                    <span className="flex-1 truncate">{c.fullName}</span>
                    <span className="text-[10px] text-muted">{countByClient.get(c.id) ?? 0}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
        <div className="min-w-0 flex-1">
          <div className="border-b border-foreground/10 px-3 py-2 text-xs text-muted">
            {browseMode === "type"
              ? selectedTypeFolder === "ALL"
                ? "All client documents"
                : DOC_CATEGORIES.find((c) => c.value === selectedTypeFolder)?.label
              : (selectedClient?.fullName ?? "All clients")}
          </div>
          {visibleDocuments.length === 0 ? (
            <p className="p-6 text-sm text-muted">No documents in this folder yet.</p>
          ) : (
            <ul className="divide-y divide-foreground/10">
              {visibleDocuments.map((doc) => (
                <li key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-foreground/[0.02]">
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
                      <Link href={`/${tenantSlug}/clients/${doc.clientId}`} className="hover:underline">
                        {doc.clientName}
                      </Link>
                      {" · "}
                      {doc.category} · {doc.uploadedAtLabel}
                      {doc.visibleInPortal ? (
                        <span className="ml-1 rounded bg-[var(--info-wash)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--info)]">
                          In portal
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {canManage ? (
                    <button
                      type="button"
                      disabled={togglingDocId === doc.id}
                      onClick={() => togglePortalVisibility(doc)}
                      className={[
                        "shrink-0 rounded-md border px-2 py-1 text-[10px] font-semibold",
                        doc.visibleInPortal
                          ? "border-[var(--info-line)] text-[var(--info)] "
                          : "border-foreground/15 text-muted",
                      ].join(" ")}
                    >
                      {togglingDocId === doc.id
                        ? "…"
                        : doc.visibleInPortal
                          ? "Hide from portal"
                          : "Share in portal"}
                    </button>
                  ) : null}
                  <ChevronRight className="h-4 w-4 text-muted" />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
