import "server-only";

import { buildCloudinaryAttachmentSignature } from "@/lib/cloudinary";
import {
  getPlatformCloudinaryConfig,
  tenantCloudinaryFolder,
  type CloudinaryArea,
} from "@/lib/cloudinary-config";
import {
  CLOUDINARY_SETUP_MESSAGE,
  type CloudinaryUploadError,
  type CloudinaryUploadSignature,
} from "@/lib/cloudinary-upload-client";
import prisma from "@/lib/db";

export type { CloudinaryUploadError, CloudinaryUploadSignature };
export { CLOUDINARY_SETUP_MESSAGE };

export async function resolveCloudinaryCredentials(
  tenantId: string,
): Promise<{ cloudName: string; apiKey: string; apiSecret: string; source: "platform" | "tenant" } | null> {
  const platform = getPlatformCloudinaryConfig();
  if (platform) {
    return {
      cloudName: platform.cloudName,
      apiKey: platform.apiKey,
      apiSecret: platform.apiSecret,
      source: "platform",
    };
  }

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: {
      cloudinaryCloudName: true,
      cloudinaryApiKey: true,
      cloudinaryApiSecret: true,
    },
  });

  if (
    settings?.cloudinaryCloudName?.trim() &&
    settings.cloudinaryApiKey?.trim() &&
    settings.cloudinaryApiSecret?.trim()
  ) {
    return {
      cloudName: settings.cloudinaryCloudName.trim(),
      apiKey: settings.cloudinaryApiKey.trim(),
      apiSecret: settings.cloudinaryApiSecret.trim(),
      source: "tenant",
    };
  }

  return null;
}

function safeUploadBasename(fileName?: string, fallback = "file") {
  return (
    (fileName || fallback)
      .toLowerCase()
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || fallback
  );
}

export async function createTenantUploadSignature(input: {
  tenantId: string;
  tenantSlug: string;
  area: CloudinaryArea;
  fileName?: string;
  publicIdPrefix?: string;
}): Promise<CloudinaryUploadSignature | CloudinaryUploadError> {
  const creds = await resolveCloudinaryCredentials(input.tenantId);
  if (!creds) {
    return { ok: false, error: CLOUDINARY_SETUP_MESSAGE };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder =
    creds.source === "platform"
      ? tenantCloudinaryFolder(input.tenantSlug, input.area)
      : (
          await prisma.tenantSettings.findUnique({
            where: { tenantId: input.tenantId },
            select: { cloudinaryFolder: true },
          })
        )?.cloudinaryFolder?.trim() || `realcorp/${input.area}`;

  const safeName = safeUploadBasename(input.fileName);
  const publicId = `${input.publicIdPrefix ?? input.tenantId}/${safeName}-${timestamp}`;
  const signature = buildCloudinaryAttachmentSignature({
    apiSecret: creds.apiSecret,
    timestamp,
    folder,
    publicId,
  });

  return {
    ok: true,
    cloudName: creds.cloudName,
    apiKey: creds.apiKey,
    folder,
    timestamp,
    publicId,
    signature,
    uploadUrl: `https://api.cloudinary.com/v1_1/${creds.cloudName}/auto/upload`,
    source: creds.source,
  };
}

export async function uploadBufferToCloudinary(input: {
  tenantId: string;
  tenantSlug: string;
  area: CloudinaryArea;
  buffer: Uint8Array;
  fileName: string;
  resourceType?: "raw" | "auto" | "image";
}): Promise<{ ok: true; secureUrl: string; publicId: string } | CloudinaryUploadError> {
  const creds = await resolveCloudinaryCredentials(input.tenantId);
  if (!creds) {
    return { ok: false, error: CLOUDINARY_SETUP_MESSAGE };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder =
    creds.source === "platform"
      ? tenantCloudinaryFolder(input.tenantSlug, input.area)
      : (
          await prisma.tenantSettings.findUnique({
            where: { tenantId: input.tenantId },
            select: { cloudinaryFolder: true },
          })
        )?.cloudinaryFolder?.trim() || `realcorp/${input.area}`;

  const safeName = safeUploadBasename(input.fileName, "document");
  const publicId = `${input.tenantId}/${safeName}-${timestamp}`;
  const signature = buildCloudinaryAttachmentSignature({
    apiSecret: creds.apiSecret,
    timestamp,
    folder,
    publicId,
  });

  const resourceType = input.resourceType ?? "raw";
  const uploadUrl = `https://api.cloudinary.com/v1_1/${creds.cloudName}/${resourceType}/upload`;
  const body = new FormData();
  body.append("file", new Blob([Buffer.from(input.buffer)], { type: "application/pdf" }), input.fileName);
  body.append("api_key", creds.apiKey);
  body.append("timestamp", String(timestamp));
  body.append("folder", folder);
  body.append("public_id", publicId);
  body.append("signature", signature);

  try {
    const response = await fetch(uploadUrl, { method: "POST", body });
    const json = (await response.json()) as {
      secure_url?: string;
      public_id?: string;
      error?: { message?: string };
    };
    if (!response.ok || !json.secure_url) {
      return { ok: false, error: json.error?.message || "File upload failed." };
    }
    return { ok: true, secureUrl: json.secure_url, publicId: json.public_id || publicId };
  } catch {
    return { ok: false, error: "Could not upload file to storage." };
  }
}
