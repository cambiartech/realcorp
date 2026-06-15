import { getPlatformCloudinaryConfig } from "@/lib/cloudinary-config";

export type CloudinaryUploadSignature = {
  ok: true;
  cloudName: string;
  apiKey: string;
  folder: string;
  timestamp: number;
  publicId: string;
  signature: string;
  uploadUrl: string;
  source: "platform" | "tenant";
};

export type CloudinaryUploadError = { ok: false; error: string };

export function isPlatformCloudinaryReady() {
  return Boolean(getPlatformCloudinaryConfig());
}

export const CLOUDINARY_SETUP_MESSAGE =
  "File uploads are not configured on this server. Contact your platform administrator.";

/** Browser upload using a server-issued signature. */
export async function uploadViaCloudinarySignature(
  file: File,
  sig: CloudinaryUploadSignature,
): Promise<{ ok: true; secureUrl: string } | { ok: false; error: string }> {
  const body = new FormData();
  body.append("file", file);
  body.append("api_key", sig.apiKey);
  body.append("timestamp", String(sig.timestamp));
  body.append("signature", sig.signature);
  body.append("folder", sig.folder);
  body.append("public_id", sig.publicId);

  const res = await fetch(sig.uploadUrl, { method: "POST", body });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: text || `Upload failed (${res.status}). Check storage configuration.` };
  }

  const payload = (await res.json()) as { secure_url?: string; error?: { message?: string } };
  if (!payload.secure_url) {
    return { ok: false, error: payload.error?.message || "Upload did not return a file URL." };
  }
  return { ok: true, secureUrl: payload.secure_url };
}
