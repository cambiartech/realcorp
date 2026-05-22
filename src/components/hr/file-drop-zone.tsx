"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";

export function FileDropZone({
  onFile,
  disabled,
  uploading,
  accept,
  hint = "PDF, Word, Excel, or images",
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
  uploading?: boolean;
  accept?: string;
  hint?: string;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(file: File | undefined) {
    if (!file || disabled || uploading) return;
    onFile(file);
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
        pick(e.dataTransfer.files[0]);
      }}
      onClick={() => inputRef.current?.click()}
      className={[
        "relative cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all",
        dragOver
          ? "border-violet-500 bg-violet-500/10 scale-[1.01]"
          : "border-foreground/20 bg-foreground/[0.02] hover:border-foreground/35 hover:bg-foreground/[0.04]",
        disabled || uploading ? "pointer-events-none opacity-50" : "",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={accept ?? ".pdf,.doc,.docx,.xls,.xlsx,image/*"}
        disabled={disabled || uploading}
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-foreground/10">
        <Upload className={`h-7 w-7 text-foreground ${uploading ? "animate-pulse" : ""}`} strokeWidth={1.5} />
      </div>
      <p className="mt-3 text-sm font-semibold text-foreground">
        {uploading ? "Uploading…" : dragOver ? "Drop file here" : "Drag & drop a file here"}
      </p>
      <p className="mt-1 text-xs text-muted">or click to browse · {hint}</p>
    </div>
  );
}
