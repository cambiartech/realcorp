export type CloudinaryArea = "finance" | "hr" | "hr-forms" | "branding" | "clients";

function readEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function parseCloudinaryUrl(url: string) {
  const match = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@([^/?#]+)/i);
  if (!match) return null;
  return {
    apiKey: decodeURIComponent(match[1]),
    apiSecret: decodeURIComponent(match[2]),
    cloudName: decodeURIComponent(match[3]),
  };
}

/** Platform-wide Cloudinary (set in deployment env). Tenants do not supply keys. */
export function getPlatformCloudinaryConfig() {
  const fromUrl = parseCloudinaryUrl(readEnv("CLOUDINARY_URL", "cloudinary_url") || "");
  const cloudName =
    readEnv("CLOUDINARY_CLOUD_NAME", "cloudinary_cloud_name") || fromUrl?.cloudName;
  const apiKey = readEnv("CLOUDINARY_API_KEY", "cloudinary_api_key") || fromUrl?.apiKey;
  const apiSecret =
    readEnv("CLOUDINARY_API_SECRET", "cloudinary_api_secret") || fromUrl?.apiSecret;
  const baseFolder =
    readEnv("CLOUDINARY_FOLDER", "cloudinary_folder")?.trim() || "realcorp";
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret, baseFolder };
}

export function tenantCloudinaryFolder(tenantSlug: string, area: CloudinaryArea) {
  const base = getPlatformCloudinaryConfig()?.baseFolder || "realcorp";
  return `${base}/${tenantSlug}/${area}`;
}
