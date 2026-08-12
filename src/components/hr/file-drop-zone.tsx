"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";

export function FileDropZone({
  onFile,
  onFiles,
  multiple = false,
  disabled,
  uploading,
  accept,
  hint = "PDF, Word, Excel, or images",
}: {
  onFile?: (file: File) => void;
  onFiles?: (files: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  uploading?: boolean;
  accept?: string;
  hint?: string;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickList(fileList: FileList | undefined) {
    if (!fileList?.length || disabled || uploading) return;
    const files = Array.from(fileList);
    if (multiple || files.length > 1) {
      onFiles?.(files);
      if (!onFiles && onFile) onFile(files[0]);
    } else {
      onFile?.(files[0]);
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        if (!disabled && !uploading) setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled && !uploading) setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        pickList(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={[
        "relative cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all",
        dragOver
          ? "border-[var(--accent-line)] bg-[var(--accent-wash)] scale-[1.01]"
          : "border-foreground/20 bg-foreground/[0.02] hover:border-foreground/35 hover:bg-foreground/[0.04]",
        disabled || uploading ? "pointer-events-none opacity-50" : "",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={accept ?? ".pdf,.doc,.docx,.xls,.xlsx,image/*"}
        multiple={multiple}
        disabled={disabled || uploading}
        onChange={(e) => {
          pickList(e.target.files ?? undefined);
          e.currentTarget.value = "";
        }}
      />
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-foreground/10">
        <Upload className={`h-7 w-7 text-foreground ${uploading ? "animate-pulse" : ""}`} strokeWidth={1.5} />
      </div>
      <p className="mt-3 text-sm font-semibold text-foreground">
        {uploading
          ? "Uploading…"
          : dragOver
            ? multiple
              ? "Drop files here"
              : "Drop file here"
            : multiple
              ? "Drag & drop files here"
              : "Drag & drop a file here"}
      </p>
      <p className="mt-1 text-xs text-muted">or click to browse · {hint}</p>
    </div>
  );
}
