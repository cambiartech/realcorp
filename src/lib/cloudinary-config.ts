export type CloudinaryArea = "finance" | "hr" | "hr-forms" | "branding";

/** Platform-wide Cloudinary (set in deployment env). Tenants do not supply keys. */
export function getPlatformCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  const baseFolder = process.env.CLOUDINARY_FOLDER?.trim() || "realcorp";
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret, baseFolder };
}

export function tenantCloudinaryFolder(tenantSlug: string, area: CloudinaryArea) {
  const base = getPlatformCloudinaryConfig()?.baseFolder || "realcorp";
  return `${base}/${tenantSlug}/${area}`;
}
