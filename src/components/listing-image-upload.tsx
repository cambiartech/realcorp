"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { FileDropZone } from "@/components/hr/file-drop-zone";
import { ButtonSpinner } from "@/components/button-spinner";
import { uploadViaCloudinarySignature } from "@/lib/cloudinary-upload-client";
import { getListingImageUploadSignature } from "@/app/[tenantSlug]/projects/actions";

type Props = {
  tenantSlug: string;
  projectId: string;
  coverUrl: string;
  galleryUrls: string[];
  onCoverChange: (url: string) => void;
  onGalleryChange: (urls: string[]) => void;
};

export function ListingImageUpload({
  tenantSlug,
  projectId,
  coverUrl,
  galleryUrls,
  onCoverChange,
  onGalleryChange,
}: Props) {
  const [coverUploading, setCoverUploading] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryProgress, setGalleryProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function uploadImage(file: File): Promise<string | null> {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, WebP).");
      return null;
    }
    setError(null);
    const sig = await getListingImageUploadSignature(tenantSlug, {
      fileName: file.name,
      projectId,
    });
    if (!sig.ok) {
      setError(sig.error);
      return null;
    }
    const uploaded = await uploadViaCloudinarySignature(file, sig);
    if (!uploaded.ok) {
      setError(uploaded.error);
      return null;
    }
    return uploaded.secureUrl;
  }

  async function handleCover(file: File) {
    setCoverUploading(true);
    try {
      const url = await uploadImage(file);
      if (url) onCoverChange(url);
    } finally {
      setCoverUploading(false);
    }
  }

  async function handleGalleryFiles(files: File[]) {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      setError("Please upload image files (JPG, PNG, WebP).");
      return;
    }
    const slotsLeft = 12 - galleryUrls.length;
    if (slotsLeft <= 0) {
      setError("Gallery is limited to 12 images.");
      return;
    }
    const toUpload = imageFiles.slice(0, slotsLeft);
    if (imageFiles.length > slotsLeft) {
      setError(`Only ${slotsLeft} more photo${slotsLeft === 1 ? "" : "s"} can be added (12 max).`);
    } else {
      setError(null);
    }

    setGalleryUploading(true);
    setGalleryProgress({ done: 0, total: toUpload.length });
    const newUrls: string[] = [];
    try {
      for (let i = 0; i < toUpload.length; i++) {
        const url = await uploadImage(toUpload[i]);
        if (url) newUrls.push(url);
        setGalleryProgress({ done: i + 1, total: toUpload.length });
      }
      if (newUrls.length > 0) onGalleryChange([...galleryUrls, ...newUrls]);
    } finally {
      setGalleryUploading(false);
      setGalleryProgress(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-md border border-[var(--danger-line)] bg-[var(--danger-wash)] px-3 py-2 text-xs text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Cover image</p>
        {coverUrl ? (
          <div className="relative mb-3 overflow-hidden rounded-lg border border-foreground/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverUrl} alt="Cover preview" className="h-40 w-full object-cover" />
            <button
              type="button"
              onClick={() => onCoverChange("")}
              className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
              aria-label="Remove cover"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        <FileDropZone
          onFile={(file) => void handleCover(file)}
          uploading={coverUploading}
          accept="image/jpeg,image/png,image/webp,image/gif"
          hint="JPG, PNG, WebP · drag & drop or click"
        />
        <input type="hidden" name="coverImageUrl" value={coverUrl} />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-foreground">
          Gallery <span className="font-normal text-muted">({galleryUrls.length}/12)</span>
        </p>
        {galleryUrls.length > 0 ? (
          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {galleryUrls.map((url, i) => (
              <div
                key={url}
                className="relative aspect-square overflow-hidden rounded-md border border-foreground/10"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => onGalleryChange(galleryUrls.filter((_, j) => j !== i))}
                  className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  aria-label="Remove image"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <FileDropZone
          multiple
          onFiles={(files) => void handleGalleryFiles(files)}
          uploading={galleryUploading}
          disabled={galleryUrls.length >= 12}
          accept="image/jpeg,image/png,image/webp,image/gif"
          hint="Select multiple or drag several at once · JPG, PNG, WebP"
        />
        <textarea
          name="galleryUrls"
          className="sr-only"
          readOnly
          value={galleryUrls.join("\n")}
          aria-hidden
        />
        {galleryUploading && galleryProgress ? (
          <p className="mt-2 flex items-center gap-2 text-xs text-muted">
            <ButtonSpinner />
            Uploading {galleryProgress.done} of {galleryProgress.total}…
          </p>
        ) : null}
      </div>
    </div>
  );
}
