"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  ExternalLink,
  File,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  HardDrive,
  Link2,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { FileDropZone } from "@/components/hr/file-drop-zone";
import { PrefillWithAiButton } from "@/components/hr/prefill-with-ai-button";
import { ModalOverlay } from "@/components/modal-overlay";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { addHrDocument, getHrUploadSignature, softDeleteHrDocument } from "@/app/[tenantSlug]/hr/actions";
import { ingestHrDocument, prefillEmployeeFromUploadedDocs } from "@/app/[tenantSlug]/hr/document-intake-actions";
import { uploadViaCloudinarySignature } from "@/lib/cloudinary-upload-client";
import { MODAL_PANEL_XS } from "@/lib/modal-panel";

const DOC_CATEGORIES = [
  { value: "BIODATA", label: "Biodata" },
  { value: "BANK_FORM", label: "Bank forms" },
  { value: "EMERGENCY_CONTACT", label: "Emergency contacts" },
  { value: "NEXT_OF_KIN", label: "Next of kin" },
  { value: "HEALTH_RECORD", label: "Health records" },
  { value: "EDUCATION", label: "Education records" },
  { value: "OFFER_LETTER", label: "Offer letters" },
  { value: "NDA", label: "NDAs" },
  { value: "GUARANTOR", label: "Guarantor" },
  { value: "JOB_DESCRIPTION", label: "Job descriptions" },
  { value: "CONTRACT", label: "Contracts" },
  { value: "PAYSLIP", label: "Payslips" },
  { value: "APPRAISAL", label: "Appraisals" },
  { value: "OTHER", label: "Other" },
] as const;

const EXTRACTABLE_CATEGORIES = new Set([
  "AUTO",
  "BIODATA",
  "BANK_FORM",
  "EMERGENCY_CONTACT",
  "NEXT_OF_KIN",
  "HEALTH_RECORD",
  "EDUCATION",
  "GUARANTOR",
  "OFFER_LETTER",
  "JOB_DESCRIPTION",
  "CONTRACT",
  "PAYSLIP",
]);

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
  pendingReviewCount,
  aiEnabled,
}: {
  tenantSlug: string;
  employees: DocumentEmployee[];
  documents: HrDocumentItem[];
  preselectUserId?: string;
  returnOnboardUserId?: string;
  pendingReviewCount: number;
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const initialEmployee = preselectUserId ? employees.find((employee) => employee.userId === preselectUserId) : null;
  const initialEmployeeKey = initialEmployee ? employeeOptionValue(initialEmployee) : null;
  const [browseMode, setBrowseMode] = useState<BrowseMode>(preselectUserId ? "employee" : "type");
  const [selectedTypeFolder, setSelectedTypeFolder] = useState<string>("ALL");
  const [selectedEmployeeKey, setSelectedEmployeeKey] = useState<string | null>(initialEmployeeKey);
  const [uploadEmployeeId, setUploadEmployeeId] = useState(initialEmployeeKey || "");
  const [uploadCategory, setUploadCategory] = useState(aiEnabled ? "AUTO" : preselectUserId ? "NDA" : "OTHER");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [generatingDocumentId, setGeneratingDocumentId] = useState<string | null>(null);
  const [prefillPending, setPrefillPending] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<HrDocumentItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showUploadPanel, setShowUploadPanel] = useState(Boolean(preselectUserId));
  const [lastUploadResults, setLastUploadResults] = useState<string[]>([]);
  const uploadPanelRef = useRef<HTMLDivElement>(null);
  const aiCategorySelected = aiEnabled && EXTRACTABLE_CATEGORIES.has(uploadCategory);

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
    () =>
      selectedEmployeeKey ? employees.find((e) => employeeOptionValue(e) === selectedEmployeeKey) : null,
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
      return [
        "All documents",
        DOC_CATEGORIES.find((c) => c.value === selectedTypeFolder)?.label ?? selectedTypeFolder,
      ];
    }
    if (!selectedEmployee) return ["Employees"];
    return ["Employees", selectedEmployee.fullName];
  }, [browseMode, selectedTypeFolder, selectedEmployee]);

  async function processFile(file: File, options?: { deferAi?: boolean }) {
    const wantsAi = aiEnabled && EXTRACTABLE_CATEGORIES.has(uploadCategory) && !options?.deferAi;
    if (!uploadEmployeeId && !wantsAi) {
      throw new Error("Select which employee this document belongs to.");
    }

    const title = uploadTitle.trim() || file.name.replace(/\.[^/.]+$/, "");
    const resourceType = /\.(pdf|docx?|xlsx?)$/i.test(file.name) ? "raw" : "auto";
    const sig = await getHrUploadSignature(tenantSlug, { fileName: file.name, resourceType });
    if (!sig.ok) throw new Error(sig.error);
    const uploaded = await uploadViaCloudinarySignature(file, sig);
    if (!uploaded.ok) throw new Error(uploaded.error);

    const saveCategory = uploadCategory === "AUTO" ? "OTHER" : uploadCategory;
    let saved = false;
    if (uploadEmployeeId) {
      const result = await addHrDocument(tenantSlug, {
        ...parseEmployeeSelection(uploadEmployeeId),
        category: saveCategory,
        title,
        fileUrl: uploaded.secureUrl,
        fileName: file.name,
      });
      if (!result.ok) throw new Error(result.error || "Could not save document.");
      saved = true;
    }

    if (!wantsAi) return `${file.name} uploaded`;

    const tooLargeForAi = file.size > 15 * 1024 * 1024;
    if (tooLargeForAi) {
      if (saved) {
        return `${file.name} uploaded. File is over 15 MB, so AI could not read it — use a smaller scan or Prefill with AI later.`;
      }
      throw new Error("Select the employee to save this file. AI extraction supports files up to 15 MB.");
    }

    try {
      const selection = parseEmployeeSelection(uploadEmployeeId);
      const result = await ingestHrDocument(tenantSlug, {
        fileUrl: uploaded.secureUrl,
        fileName: file.name,
        fileMimeType: file.type || undefined,
        category: uploadCategory,
        preferredProfileId: selection.employeeProfileId,
        preferredUserId: selection.userId,
        skipDocumentCreate: saved,
      });
      if (!result.ok) {
        if (saved) {
          return `${file.name} uploaded. AI could not read it yet — use Prefill with AI.`;
        }
        throw new Error(`${result.error} Select the employee to save the file without waiting on AI.`);
      }
      const categoryLabel =
        DOC_CATEGORIES.find((category) => category.value === result.category)?.label || result.category;
      return saved
        ? `${file.name} uploaded · AI read ${categoryLabel} for ${result.personName}`
        : `${file.name} → ${categoryLabel} → ${result.personName} (${result.matchedBy}, ${Math.round(
            result.confidence * 100,
          )}% confidence)`;
    } catch (error) {
      if (saved) {
        return `${file.name} uploaded. AI could not read it yet — use Prefill with AI.`;
      }
      throw error instanceof Error ? error : new Error("Upload failed.");
    }
  }

  async function generateRecords(document: HrDocumentItem) {
    setGeneratingDocumentId(document.id);
    const result = await ingestHrDocument(tenantSlug, {
      fileUrl: document.fileUrl,
      fileName: document.fileName,
      category: document.categoryValue,
      preferredProfileId: document.employeeProfileId,
    });
    setGeneratingDocumentId(null);
    if (!result.ok) {
      showSnackbar(
        result.error.includes("could not be read")
          ? "This older stored file cannot be read by the extractor. Re-upload it once to generate records."
          : result.error,
        "error",
      );
      return;
    }
    showSnackbar(`Records generated for ${result.personName} and staged for approval.`, "success");
    router.refresh();
  }

  function mapSimilar(document: HrDocumentItem) {
    setUploadEmployeeId(document.employeeProfileId);
    setUploadCategory(document.categoryValue);
    setShowUploadPanel(true);
    window.setTimeout(() => uploadPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  async function removeDocument() {
    if (!documentToDelete) return;
    setDeleting(true);
    const result = await softDeleteHrDocument(tenantSlug, documentToDelete.id);
    setDeleting(false);
    if (!result.ok) {
      showSnackbar(result.error || "Could not remove this document.", "error");
      return;
    }
    showSnackbar("Document removed from the library.", "success");
    setDocumentToDelete(null);
    router.refresh();
  }

  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    const completed: string[] = [];
    const failed: string[] = [];
    const deferAi = files.length > 1;
    for (const file of files) {
      try {
        completed.push(await processFile(file, { deferAi }));
      } catch (error) {
        failed.push(`${file.name}: ${error instanceof Error ? error.message : "Upload failed."}`);
      }
    }
    setUploading(false);
    
    setLastUploadResults([...completed, ...failed.map((message) => `Failed: ${message}`)]);
    if (completed.length) {
      const aiLater = completed.filter((message) => message.includes("AI could not read"));
      const fullyOk = completed.filter((message) => !message.includes("AI could not read"));
      if (fullyOk.length) {
        showSnackbar(
          `${fullyOk.length} document${fullyOk.length === 1 ? "" : "s"} uploaded.`,
          "success",
        );
      }
      if (aiLater.length || deferAi) {
        showSnackbar(
          deferAi
            ? "Files are saved. Gemini is rate-limited if we extract every file at once — open the employee folder and use Prefill with AI."
            : "Files are saved. AI could not read them yet — open the employee folder and use Prefill with AI.",
          "info",
        );
      }
    }
    if (failed.length) showSnackbar(failed.join(" "), "error");
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
      {pendingReviewCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--warn-line)] bg-[var(--warn-wash)] px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {pendingReviewCount} extracted document{pendingReviewCount === 1 ? "" : "s"} awaiting HR approval
            </p>
            <p className="text-xs text-muted">
              Review the detected employee and fields before updating employee records.
            </p>
          </div>
          <Link
            href={`/${tenantSlug}/hr/people?reviewForms=1`}
            className="rounded-md bg-foreground px-3 py-2 text-xs font-semibold text-background"
          >
            Review and approve →
          </Link>
        </div>
      ) : null}
      {returnOnboardUserId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--accent-line)] bg-[var(--accent-wash)] px-4 py-3">
          <p className="text-sm text-foreground">
            Upload documents for this employee, then return to onboarding.
          </p>
          <Link
            href={`/${tenantSlug}/hr/people?onboard=${encodeURIComponent(returnOnboardUserId)}`}
            className="text-xs font-semibold text-[var(--accent)] underline"
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
        <div
          ref={uploadPanelRef}
          className="scroll-mt-4 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 shadow-sm"
        >
          <p className="mb-3 text-sm font-semibold text-foreground">Upload & map to employee</p>
          <div className="grid gap-4 lg:grid-cols-[1fr_minmax(220px,280px)]">
            <FileDropZone
              onFile={(file) => void uploadFiles([file])}
              onFiles={(files) => void uploadFiles(files)}
              multiple
              uploading={uploading}
              disabled={!aiCategorySelected && !uploadEmployeeId}
              hint="PDF, DOCX, XLSX, or images · multiple files allowed"
            />
            <div className="flex flex-col gap-3">
              <label className="text-xs font-medium text-muted">
                Employee {aiCategorySelected ? "(recommended)" : null}
              </label>
              <UiSelect value={uploadEmployeeId} onChange={(e) => setUploadEmployeeId(e.target.value)}>
                <option value="">
                  {aiCategorySelected ? "Auto-match each file…" : "Select employee…"}
                </option>
                {employees.map((e) => (
                  <option key={e.userId} value={employeeOptionValue(e)}>
                    {e.fullName}
                    {!e.profileId ? " (new HR record)" : ""}
                  </option>
                ))}
              </UiSelect>
              <label className="text-xs font-medium text-muted">Folder / type</label>
              <UiSelect value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}>
                {aiEnabled ? <option value="AUTO">✨ Auto-detect each file</option> : null}
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
                placeholder="Optional; file name is used by default"
                className="w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
              />
            </div>
          </div>
          {lastUploadResults.length ? (
            <div className="mt-3 rounded-lg border border-foreground/10 bg-background p-3">
              <p className="text-xs font-semibold text-foreground">Last bulk upload</p>
              <ul className="mt-1 space-y-1 text-xs text-muted">
                {lastUploadResults.map((result) => (
                  <li key={result}>{result}</li>
                ))}
              </ul>
            </div>
          ) : null}
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
                    selectedTypeFolder === "ALL"
                      ? "bg-[var(--warn-wash)] font-semibold text-foreground"
                      : "hover:bg-foreground/[0.06]",
                  ].join(" ")}
                >
                  {selectedTypeFolder === "ALL" ? (
                    <FolderOpen
                      className="h-5 w-5 shrink-0 text-[var(--warn)]"
                      fill="currentColor"
                      fillOpacity={0.2}
                    />
                  ) : (
                    <Folder
                      className="h-5 w-5 shrink-0 text-[var(--warn)]"
                      fill="currentColor"
                      fillOpacity={0.15}
                    />
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
                        active
                          ? "bg-[var(--warn-wash)] font-semibold text-foreground"
                          : "hover:bg-foreground/[0.06]",
                      ].join(" ")}
                    >
                      {active ? (
                        <FolderOpen
                          className="h-5 w-5 shrink-0 text-[var(--warn)]"
                          fill="currentColor"
                          fillOpacity={0.2}
                        />
                      ) : (
                        <Folder
                          className="h-5 w-5 shrink-0 text-[var(--warn)]"
                          fill="currentColor"
                          fillOpacity={0.15}
                        />
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
                    !selectedEmployeeKey
                      ? "bg-[var(--warn-wash)] font-semibold"
                      : "hover:bg-foreground/[0.06]",
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
                        active
                          ? "bg-[var(--warn-wash)] font-semibold text-foreground"
                          : "hover:bg-foreground/[0.06]",
                      ].join(" ")}
                    >
                      {active ? (
                        <FolderOpen
                          className="h-5 w-5 shrink-0 text-[var(--warn)]"
                          fill="currentColor"
                          fillOpacity={0.2}
                        />
                      ) : (
                        <Folder
                          className="h-5 w-5 shrink-0 text-[var(--warn)]"
                          fill="currentColor"
                          fillOpacity={0.15}
                        />
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
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-foreground/10 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-1">
              {breadcrumb.map((part, i) => (
                <span key={part} className="inline-flex items-center gap-1">
                  {i > 0 ? <ChevronRight className="h-3 w-3 text-muted" /> : null}
                  <span
                    className={i === breadcrumb.length - 1 ? "font-semibold text-foreground" : "text-muted"}
                  >
                    {part}
                  </span>
                </span>
              ))}
            </div>
            {aiEnabled && browseMode === "employee" && selectedEmployee ? (
              <PrefillWithAiButton
                pending={prefillPending}
                pendingLabel="Prefilling…"
                className="w-auto"
                onClick={() => {
                  void (async () => {
                    setPrefillPending(true);
                    const result = await prefillEmployeeFromUploadedDocs(tenantSlug, selectedEmployee.userId);
                    setPrefillPending(false);
                    if (!result.ok) {
                      showSnackbar(result.error, "error");
                      return;
                    }
                    if (!result.applied) {
                      showSnackbar(
                        result.failed[0]?.error ||
                          "Uploaded files were found, but no employee fields could be read.",
                        "error",
                      );
                      return;
                    }
                    showSnackbar(
                      `Filled ${result.filled.join(", ") || "employee fields"} from uploaded documents.`,
                      "success",
                    );
                    router.refresh();
                  })();
                }}
              />
            ) : null}
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
                      className="flex flex-col items-center rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4 text-center transition hover:border-[var(--warn-line)] hover:bg-[var(--warn-wash)]"
                    >
                      <Folder
                        className="h-12 w-12 text-[var(--warn)]"
                        fill="currentColor"
                        fillOpacity={0.18}
                        strokeWidth={1}
                      />
                      <span className="mt-2 line-clamp-2 text-xs font-semibold text-foreground">
                        {cat.label}
                      </span>
                      <span className="mt-0.5 text-[10px] text-muted">
                        {count} file{count === 1 ? "" : "s"}
                      </span>
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
                      className="flex flex-col items-center rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4 transition hover:border-[var(--warn-line)] hover:bg-[var(--warn-wash)]"
                    >
                      <Folder
                        className="h-12 w-12 text-[var(--warn)]"
                        fill="currentColor"
                        fillOpacity={0.18}
                      />
                      <span className="mt-2 line-clamp-2 text-center text-xs font-semibold">
                        {e.fullName}
                      </span>
                      <span className="text-[10px] text-muted">
                        {count} file{count === 1 ? "" : "s"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {(browseMode === "type" && selectedTypeFolder !== "ALL") ||
            (browseMode === "employee" && selectedEmployeeKey) ? (
              visibleDocuments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Folder className="h-16 w-16 text-[var(--warn)]" fill="currentColor" fillOpacity={0.12} />
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
                    <article
                      key={d.id}
                      className="flex min-h-52 flex-col rounded-xl border border-foreground/10 bg-background p-4 shadow-sm transition hover:border-foreground/20 hover:shadow-md"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={[
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                            fileKind(d.fileName) === "pdf"
                              ? "bg-[var(--danger-wash)] text-[var(--danger)]"
                              : fileKind(d.fileName) === "image"
                                ? "bg-[var(--info-wash)] text-[var(--info)]"
                                : "bg-foreground/10 text-foreground",
                          ].join(" ")}
                        >
                          <FileIcon fileName={d.fileName} className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-semibold leading-5 text-foreground" title={d.title}>
                            {d.title}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] text-muted" title={d.fileName}>
                            {d.fileName}
                          </p>
                          <span className="mt-1 inline-flex rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[10px] font-medium text-muted">
                            {d.category}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDocumentToDelete(d)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-[var(--danger-wash)] hover:text-[var(--danger)]"
                          aria-label={`Remove ${d.title}`}
                          title="Remove document"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-4 flex items-center gap-2 text-xs text-muted">
                        <UserRound className="h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{d.employeeName}</span>
                        <span className="shrink-0 text-[10px]">{d.uploadedAtLabel}</span>
                      </div>

                      <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                        <Link
                          href={d.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-foreground/15 px-2.5 py-2 text-xs font-semibold hover:bg-foreground/[0.05]"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Open
                        </Link>
                        <button
                          type="button"
                          onClick={() => mapSimilar(d)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-foreground/15 px-2.5 py-2 text-xs font-semibold hover:bg-foreground/[0.05]"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Map similar
                        </button>
                        {aiEnabled && EXTRACTABLE_CATEGORIES.has(d.categoryValue) ? (
                          <button
                            type="button"
                            disabled={generatingDocumentId === d.id}
                            onClick={() => void generateRecords(d)}
                            className="col-span-2 rounded-md bg-foreground px-3 py-2 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-50"
                          >
                            {generatingDocumentId === d.id ? "Generating records…" : "Generate records"}
                          </button>
                        ) : null}
                      </div>
                    </article>
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
                      className="flex items-center gap-3 rounded-lg border border-foreground/10 bg-background px-3 py-3 text-sm shadow-sm"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.05]">
                        <FileIcon fileName={d.fileName} className="h-4 w-4 text-muted" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-foreground">{d.title}</p>
                        <p className="truncate text-[11px] text-muted">
                          {d.employeeName} · {d.category}
                        </p>
                      </div>
                      <Link
                        href={d.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-foreground/10 hover:bg-foreground/[0.05]"
                        aria-label={`Open ${d.title}`}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setDocumentToDelete(d)}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-[var(--danger-wash)] hover:text-[var(--danger)]"
                        aria-label={`Remove ${d.title}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ModalOverlay
        open={Boolean(documentToDelete)}
        onClose={() => {
          if (!deleting) setDocumentToDelete(null);
        }}
        panelClassName={MODAL_PANEL_XS}
        aria-labelledby="remove-hr-document-title"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--danger-wash)] text-[var(--danger)]">
          <Trash2 className="h-5 w-5" />
        </div>
        <h2 id="remove-hr-document-title" className="mt-4 text-lg font-semibold text-foreground">
          Remove this document?
        </h2>
        <p className="mt-2 text-sm text-muted">
          <strong className="font-semibold text-foreground">{documentToDelete?.title}</strong> will disappear from{" "}
          {documentToDelete?.employeeName}&apos;s document library and employee view.
        </p>
        <p className="mt-3 rounded-md border border-foreground/10 bg-foreground/[0.03] px-3 py-2 text-xs text-muted">
          This is a soft delete. The removal remains in the audit trail and can be recovered by an administrator.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={deleting}
            onClick={() => setDocumentToDelete(null)}
            className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-medium hover:bg-foreground/[0.05] disabled:opacity-50"
          >
            Keep document
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={() => void removeDocument()}
            className="rounded-md bg-[var(--danger)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {deleting ? "Removing…" : "Remove document"}
          </button>
        </div>
      </ModalOverlay>
    </div>
  );
}
