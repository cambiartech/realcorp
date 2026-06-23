"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  File,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  HardDrive,
  Users,
} from "lucide-react";
import { FileDropZone } from "@/components/hr/file-drop-zone";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { addHrDocument, getHrUploadSignature } from "@/app/[tenantSlug]/hr/actions";
import { uploadViaCloudinarySignature } from "@/lib/cloudinary-upload-client";

const DOC_CATEGORIES = [
  { value: "BIODATA", label: "Biodata" },
  { value: "BANK_FORM", label: "Bank forms" },
  { value: "OFFER_LETTER", label: "Offer letters" },
  { value: "NDA", label: "NDAs" },
  { value: "GUARANTOR", label: "Guarantor" },
  { value: "JOB_DESCRIPTION", label: "Job descriptions" },
  { value: "CONTRACT", label: "Contracts" },
  { value: "PAYSLIP", label: "Payslips" },
  { value: "APPRAISAL", label: "Appraisals" },
  { value: "OTHER", label: "Other" },
] as const;

type BrowseMode = "type" | "employee";

export type HrDocumentItem = {
  id: string;
  employeeProfileId: string;
  employeeName: string;
  category: string;
  categoryValue: string;
  title: string;
  fileUrl: string;
  fileName: string;
  uploadedAtLabel: string;
};

export type DocumentEmployee = {
  profileId: string | null;
  userId: string;
  fullName: string;
};

function employeeOptionValue(e: DocumentEmployee) {
  return e.profileId ?? `user:${e.userId}`;
}

function parseEmployeeSelection(value: string): { employeeProfileId?: string; userId?: string } {
  if (value.startsWith("user:")) return { userId: value.slice(5) };
  if (value) return { employeeProfileId: value };
  return {};
}

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

export function HrDocumentsWorkspace({
  tenantSlug,
  employees,
  documents,
  preselectUserId,
  returnOnboardUserId,
}: {
  tenantSlug: string;
  employees: DocumentEmployee[];
  documents: HrDocumentItem[];
  preselectUserId?: string;
  returnOnboardUserId?: string;
}) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [browseMode, setBrowseMode] = useState<BrowseMode>(preselectUserId ? "employee" : "type");
  const [selectedTypeFolder, setSelectedTypeFolder] = useState<string>("ALL");
  const [selectedEmployeeKey, setSelectedEmployeeKey] = useState<string | null>(null);
  const [uploadEmployeeId, setUploadEmployeeId] = useState("");
  const [uploadCategory, setUploadCategory] = useState("NDA");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showUploadPanel, setShowUploadPanel] = useState(Boolean(preselectUserId));

  useEffect(() => {
    if (!preselectUserId) return;
    const emp = employees.find((e) => e.userId === preselectUserId);
    if (!emp) return;
    const key = employeeOptionValue(emp);
    setBrowseMode("employee");
    setSelectedEmployeeKey(key);
    setUploadEmployeeId(key);
    setUploadCategory("NDA");
    setShowUploadPanel(true);
  }, [preselectUserId, employees]);

  const countByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of documents) {
      m.set(d.categoryValue, (m.get(d.categoryValue) ?? 0) + 1);
    }
    return m;
  }, [documents]);

  const countByEmployee = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of documents) {
      m.set(d.employeeProfileId, (m.get(d.employeeProfileId) ?? 0) + 1);
    }
    return m;
  }, [documents]);

  const selectedEmployee = useMemo(
    () => (selectedEmployeeKey ? employees.find((e) => employeeOptionValue(e) === selectedEmployeeKey) : null),
    [selectedEmployeeKey, employees],
  );

  const visibleDocuments = useMemo(() => {
    if (browseMode === "type") {
      if (selectedTypeFolder === "ALL") return documents;
      return documents.filter((d) => d.categoryValue === selectedTypeFolder);
    }
    if (!selectedEmployee?.profileId) return [];
    return documents.filter((d) => d.employeeProfileId === selectedEmployee.profileId);
  }, [browseMode, selectedTypeFolder, selectedEmployee, documents]);

  const breadcrumb = useMemo(() => {
    if (browseMode === "type") {
      if (selectedTypeFolder === "ALL") return ["All documents"];
      return ["All documents", DOC_CATEGORIES.find((c) => c.value === selectedTypeFolder)?.label ?? selectedTypeFolder];
    }
    if (!selectedEmployee) return ["Employees"];
    return ["Employees", selectedEmployee.fullName];
  }, [browseMode, selectedTypeFolder, selectedEmployee]);

  async function uploadFile(file: File) {
    if (!uploadEmployeeId) {
      showSnackbar("Select which employee this document belongs to.", "error");
      return;
    }
    const title = uploadTitle.trim() || file.name.replace(/\.[^/.]+$/, "");
    setUploading(true);
    const sig = await getHrUploadSignature(tenantSlug, { fileName: file.name });
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
    const result = await addHrDocument(tenantSlug, {
      ...parseEmployeeSelection(uploadEmployeeId),
      category: uploadCategory,
      title,
      fileUrl: uploaded.secureUrl,
      fileName: file.name,
    });
    if (!result.ok) {
      showSnackbar(result.error || "Could not save document.", "error");
      return;
    }
    showSnackbar("Document uploaded.", "success");
    setUploadTitle("");
    router.refresh();
  }

  function selectTypeFolder(id: string) {
    setSelectedTypeFolder(id);
    if (id !== "ALL") setUploadCategory(id);
  }

  function selectEmployee(emp: DocumentEmployee) {
    const key = employeeOptionValue(emp);
    setSelectedEmployeeKey(key);
    setUploadEmployeeId(key);
  }

  return (
    <div className="space-y-4">
      {returnOnboardUserId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-500/25 bg-violet-500/5 px-4 py-3">
          <p className="text-sm text-foreground">
            Upload documents for this employee, then return to onboarding.
          </p>
          <Link
            href={`/${tenantSlug}/hr/people?onboard=${encodeURIComponent(returnOnboardUserId)}`}
            className="text-xs font-semibold text-violet-800 underline"
          >
            ← Back to onboarding (Forms & documents)
          </Link>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-foreground/10 p-0.5">
          <button
            type="button"
            onClick={() => {
              setBrowseMode("type");
              setSelectedEmployeeKey(null);
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
              setBrowseMode("employee");
              setSelectedTypeFolder("ALL");
            }}
            className={[
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold",
              browseMode === "employee" ? "bg-foreground text-background" : "text-muted",
            ].join(" ")}
          >
            <Users className="h-3.5 w-3.5" />
            By employee
          </button>
        </div>
        <button
          type="button"
          onClick={() => setShowUploadPanel((v) => !v)}
          className="text-xs font-semibold text-foreground underline"
        >
          {showUploadPanel ? "Hide upload" : "Upload new file"}
        </button>
      </div>

      {showUploadPanel ? (
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-foreground">Upload & map to employee</p>
          <div className="grid gap-4 lg:grid-cols-[1fr_minmax(220px,280px)]">
            <FileDropZone onFile={uploadFile} uploading={uploading} disabled={!uploadEmployeeId && !employees.length} />
            <div className="flex flex-col gap-3">
              <label className="text-xs font-medium text-muted">
                Employee <span className="text-red-600">*</span>
              </label>
              <UiSelect
                value={uploadEmployeeId}
                onChange={(e) => setUploadEmployeeId(e.target.value)}
              >
                <option value="">Select employee…</option>
                {employees.map((e) => (
                  <option key={e.userId} value={employeeOptionValue(e)}>
                    {e.fullName}
                    {!e.profileId ? " (new HR record)" : ""}
                  </option>
                ))}
              </UiSelect>
              <label className="text-xs font-medium text-muted">Folder / type</label>
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
                placeholder="e.g. Signed NDA — March 2026"
                className="w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex min-h-[420px] overflow-hidden rounded-xl border border-foreground/10 bg-foreground/[0.01]">
        {/* Folder sidebar */}
        <aside className="w-56 shrink-0 border-r border-foreground/10 bg-foreground/[0.03] p-2 sm:w-64">
          <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-muted">Folders</p>
          {browseMode === "type" ? (
            <ul className="space-y-0.5">
              <li>
                <button
                  type="button"
                  onClick={() => selectTypeFolder("ALL")}
                  className={[
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                    selectedTypeFolder === "ALL" ? "bg-amber-500/15 font-semibold text-foreground" : "hover:bg-foreground/[0.06]",
                  ].join(" ")}
                >
                  {selectedTypeFolder === "ALL" ? (
                    <FolderOpen className="h-5 w-5 shrink-0 text-amber-600" fill="currentColor" fillOpacity={0.2} />
                  ) : (
                    <Folder className="h-5 w-5 shrink-0 text-amber-600" fill="currentColor" fillOpacity={0.15} />
                  )}
                  <span className="min-w-0 flex-1 truncate">All documents</span>
                  <span className="text-[10px] text-muted">{documents.length}</span>
                </button>
              </li>
              {DOC_CATEGORIES.map((cat) => {
                const active = selectedTypeFolder === cat.value;
                const count = countByCategory.get(cat.value) ?? 0;
                return (
                  <li key={cat.value}>
                    <button
                      type="button"
                      onClick={() => selectTypeFolder(cat.value)}
                      className={[
                        "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                        active ? "bg-amber-500/15 font-semibold text-foreground" : "hover:bg-foreground/[0.06]",
                      ].join(" ")}
                    >
                      {active ? (
                        <FolderOpen className="h-5 w-5 shrink-0 text-amber-600" fill="currentColor" fillOpacity={0.2} />
                      ) : (
                        <Folder className="h-5 w-5 shrink-0 text-amber-600" fill="currentColor" fillOpacity={0.15} />
                      )}
                      <span className="min-w-0 flex-1 truncate">{cat.label}</span>
                      <span className="text-[10px] text-muted">{count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="space-y-0.5">
              <li>
                <button
                  type="button"
                  onClick={() => setSelectedEmployeeKey(null)}
                  className={[
                    "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm",
                    !selectedEmployeeKey ? "bg-amber-500/15 font-semibold" : "hover:bg-foreground/[0.06]",
                  ].join(" ")}
                >
                  <Users className="h-5 w-5 text-muted" />
                  <span>All employees</span>
                </button>
              </li>
              {employees.map((e) => {
                const active = selectedEmployeeKey === employeeOptionValue(e);
                const count = e.profileId ? (countByEmployee.get(e.profileId) ?? 0) : 0;
                return (
                  <li key={e.userId}>
                    <button
                      type="button"
                      onClick={() => selectEmployee(e)}
                      className={[
                        "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                        active ? "bg-amber-500/15 font-semibold text-foreground" : "hover:bg-foreground/[0.06]",
                      ].join(" ")}
                    >
                      {active ? (
                        <FolderOpen className="h-5 w-5 shrink-0 text-amber-600" fill="currentColor" fillOpacity={0.2} />
                      ) : (
                        <Folder className="h-5 w-5 shrink-0 text-amber-600" fill="currentColor" fillOpacity={0.15} />
                      )}
                      <span className="min-w-0 flex-1 truncate">{e.fullName}</span>
                      <span className="text-[10px] text-muted">{count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Main explorer */}
        <div className="min-w-0 flex-1 flex flex-col">
          <div className="flex flex-wrap items-center gap-1 border-b border-foreground/10 px-3 py-2 text-xs">
            {breadcrumb.map((part, i) => (
              <span key={part} className="inline-flex items-center gap-1">
                {i > 0 ? <ChevronRight className="h-3 w-3 text-muted" /> : null}
                <span className={i === breadcrumb.length - 1 ? "font-semibold text-foreground" : "text-muted"}>
                  {part}
                </span>
              </span>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {browseMode === "type" && selectedTypeFolder === "ALL" ? (
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {DOC_CATEGORIES.map((cat) => {
                  const count = countByCategory.get(cat.value) ?? 0;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => selectTypeFolder(cat.value)}
                      className="flex flex-col items-center rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4 text-center transition hover:border-amber-500/40 hover:bg-amber-500/5"
                    >
                      <Folder className="h-12 w-12 text-amber-600" fill="currentColor" fillOpacity={0.18} strokeWidth={1} />
                      <span className="mt-2 line-clamp-2 text-xs font-semibold text-foreground">{cat.label}</span>
                      <span className="mt-0.5 text-[10px] text-muted">{count} file{count === 1 ? "" : "s"}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {browseMode === "employee" && !selectedEmployeeKey ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {employees.map((e) => {
                  const count = e.profileId ? (countByEmployee.get(e.profileId) ?? 0) : 0;
                  return (
                    <button
                      key={e.userId}
                      type="button"
                      onClick={() => selectEmployee(e)}
                      className="flex flex-col items-center rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4 transition hover:border-amber-500/40 hover:bg-amber-500/5"
                    >
                      <Folder className="h-12 w-12 text-amber-600" fill="currentColor" fillOpacity={0.18} />
                      <span className="mt-2 line-clamp-2 text-center text-xs font-semibold">{e.fullName}</span>
                      <span className="text-[10px] text-muted">{count} file{count === 1 ? "" : "s"}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {(browseMode === "type" && selectedTypeFolder !== "ALL") ||
            (browseMode === "employee" && selectedEmployeeKey) ? (
              visibleDocuments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Folder className="h-16 w-16 text-amber-600/40" fill="currentColor" fillOpacity={0.12} />
                  <p className="mt-3 text-sm font-medium text-foreground">This folder is empty</p>
                  <p className="mt-1 text-xs text-muted">
                    {selectedEmployee && !selectedEmployee.profileId
                      ? "Upload a file and we will create their HR record automatically."
                      : "Upload a file and assign it here."}
                  </p>
                  {!showUploadPanel ? (
                    <button
                      type="button"
                      onClick={() => setShowUploadPanel(true)}
                      className="mt-4 rounded-md border border-foreground/15 px-3 py-1.5 text-xs font-semibold hover:bg-foreground/[0.06]"
                    >
                      Upload new file
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleDocuments.map((d) => (
                    <div
                      key={d.id}
                      className="group flex gap-3 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3 shadow-sm transition hover:border-foreground/20 hover:shadow-md"
                    >
                      <div
                        className={[
                          "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg",
                          fileKind(d.fileName) === "pdf"
                            ? "bg-red-500/10 text-red-700"
                            : fileKind(d.fileName) === "image"
                              ? "bg-sky-500/10 text-sky-700"
                              : "bg-foreground/10 text-foreground",
                        ].join(" ")}
                      >
                        <FileIcon fileName={d.fileName} className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground" title={d.title}>
                          {d.title}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {browseMode === "type" ? d.employeeName : d.category}
                        </p>
                        <p className="text-[10px] text-muted">{d.uploadedAtLabel}</p>
                        <div className="mt-2 flex gap-2">
                          <Link
                            href={d.fileUrl}
                            target="_blank"
                            className="rounded-md border border-foreground/15 px-2 py-1 text-[11px] font-semibold hover:bg-foreground/[0.06]"
                          >
                            Open
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setUploadEmployeeId(d.employeeProfileId);
                              setUploadCategory(d.categoryValue);
                              setShowUploadPanel(true);
                            }}
                            className="text-[11px] text-muted underline opacity-0 transition group-hover:opacity-100"
                          >
                            Map similar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : null}

            {browseMode === "type" && selectedTypeFolder === "ALL" && documents.length > 0 ? (
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Recent files</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {documents.slice(0, 12).map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-2 rounded-md border border-foreground/10 bg-background px-3 py-2 text-sm"
                    >
                      <FileIcon fileName={d.fileName} className="h-4 w-4 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1 truncate">{d.title}</span>
                      <Link href={d.fileUrl} target="_blank" className="shrink-0 text-xs font-semibold underline">
                        Open
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
