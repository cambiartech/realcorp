"use client";

import { Camera, Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSnackbar } from "@/components/snackbar";
import {
  getEmployeePhotoUploadSignature,
  saveEmployeePhoto,
} from "@/app/[tenantSlug]/hr/actions";
import { uploadViaCloudinarySignature } from "@/lib/cloudinary-upload-client";

type Props = {
  tenantSlug: string;
  userId: string;
  fullName?: string | null;
  photoUrl?: string | null;
  readOnly?: boolean;
  /** Compact for forms; default is a fuller card. */
  compact?: boolean;
  /** Circle only. A click opens the photo picker. */
  variant?: "card" | "avatar";
  size?: "sm" | "md" | "lg";
};

export function EmployeePassportPhotoUpload({
  tenantSlug,
  userId,
  fullName,
  photoUrl,
  readOnly = false,
  compact = false,
  variant = "card",
  size = "md",
}: Props) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(photoUrl || null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  async function uploadFile(file: File) {
    if (readOnly || busy) return;
    if (!file.type.startsWith("image/")) {
      showSnackbar("Use a JPG, PNG, or WebP photo.", "error");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showSnackbar("Keep the photo under 8 MB.", "error");
      return;
    }

    setBusy(true);
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    try {
      const signature = await getEmployeePhotoUploadSignature(tenantSlug, {
        fileName: file.name,
        userId,
      });
      if (!signature.ok) {
        showSnackbar(signature.error, "error");
        setPreviewUrl(photoUrl || null);
        return;
      }
      const uploaded = await uploadViaCloudinarySignature(file, signature);
      if (!uploaded.ok) {
        showSnackbar(uploaded.error, "error");
        setPreviewUrl(photoUrl || null);
        return;
      }
      const saved = await saveEmployeePhoto(tenantSlug, {
        userId,
        photoUrl: uploaded.secureUrl,
      });
      if (!saved.ok) {
        showSnackbar(saved.error, "error");
        setPreviewUrl(photoUrl || null);
        return;
      }
      setPreviewUrl(uploaded.secureUrl);
      showSnackbar("Passport photo saved.", "success");
      router.refresh();
    } finally {
      URL.revokeObjectURL(localPreview);
      setBusy(false);
    }
  }

  async function removePhoto() {
    if (readOnly || busy || !previewUrl) return;
    setBusy(true);
    try {
      const saved = await saveEmployeePhoto(tenantSlug, { userId, photoUrl: null });
      if (!saved.ok) {
        showSnackbar(saved.error, "error");
        return;
      }
      setPreviewUrl(null);
      showSnackbar("Passport photo removed.", "success");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const initials = (fullName || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

  const sizeClass = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-20 w-20" : "h-10 w-10";

  if (variant === "avatar") {
    return (
      <div className="relative shrink-0">
        <button
          type="button"
          disabled={readOnly || busy}
          title={readOnly ? fullName || "Passport photo" : "Upload passport photo"}
          aria-label={readOnly ? fullName || "Passport photo" : "Upload passport photo"}
          onClick={() => inputRef.current?.click()}
          className={[
            "overflow-hidden rounded-full border border-foreground/15 bg-foreground/[0.06] text-xs font-semibold text-foreground",
            sizeClass,
            readOnly ? "cursor-default" : "cursor-pointer hover:opacity-90",
          ].join(" ")}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center">{initials || "?"}</span>
          )}
        </button>
        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
            <Loader2 className="h-4 w-4 animate-spin text-foreground" />
          </div>
        ) : null}
        {!readOnly ? (
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void uploadFile(file);
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={[
        "rounded-xl border border-foreground/10 bg-foreground/[0.02]",
        compact ? "p-3" : "p-4",
      ].join(" ")}
    >
      <div className={`flex ${compact ? "items-center gap-3" : "flex-col gap-4 sm:flex-row sm:items-center"}`}>
        <div className="relative shrink-0">
          <div
            className={[
              "overflow-hidden rounded-full border-2 border-foreground/10 bg-background shadow-sm",
              compact ? "h-16 w-16" : "h-28 w-28",
            ].join(" ")}
          >
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={fullName || "Passport photo"} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-foreground/[0.06] to-foreground/[0.02] text-lg font-semibold text-muted">
                {initials || <Camera className="h-6 w-6 opacity-60" />}
              </div>
            )}
          </div>
          {busy ? (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
              <Loader2 className="h-5 w-5 animate-spin text-foreground" />
            </div>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Passport photo</p>

          {!readOnly ? (
            <div
              className={[
                "mt-3 rounded-lg border border-dashed px-3 py-3 transition-colors",
                dragOver ? "border-foreground bg-foreground/[0.04]" : "border-foreground/20 bg-background",
                busy ? "opacity-60" : "cursor-pointer hover:border-foreground/40",
              ].join(" ")}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void uploadFile(file);
              }}
              onClick={() => !busy && inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-center gap-2 text-xs text-muted">
                <Upload className="h-4 w-4 shrink-0 text-foreground" />
                <span>
                  {busy ? "Uploading…" : "Drop a photo here, or click to choose"} · JPG, PNG, WebP · max 8 MB
                </span>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void uploadFile(file);
                }}
              />
            </div>
          ) : null}

          {!readOnly && previewUrl ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void removePhoto()}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted underline hover:text-foreground disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove photo
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
