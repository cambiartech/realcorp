import "server-only";

import { buildCloudinaryAttachmentSignature } from "@/lib/cloudinary";
import { getPlatformCloudinaryConfig, tenantCloudinaryFolder, type CloudinaryArea } from "@/lib/cloudinary-config";
import {
  CLOUDINARY_SETUP_MESSAGE,
  type CloudinaryUploadError,
  type CloudinaryUploadSignature,
} from "@/lib/cloudinary-upload-client";
import prisma from "@/lib/db";

export type { CloudinaryUploadError, CloudinaryUploadSignature };
export { CLOUDINARY_SETUP_MESSAGE };

export async function resolveCloudinaryCredentials(tenantId: string): Promise<
  | { cloudName: string; apiKey: string; apiSecret: string; source: "platform" | "tenant" }
  | null
> {
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
  return (fileName || fallback)
    .toLowerCase()
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || fallback;
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
      : (await prisma.tenantSettings.findUnique({
          where: { tenantId: input.tenantId },
          select: { cloudinaryFolder: true },
        }))?.cloudinaryFolder?.trim() || `realcorp/${input.area}`;

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
