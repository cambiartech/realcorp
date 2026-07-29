import { CampaignStatus } from "@/generated/prisma";
import prisma from "@/lib/db";

export async function resolveCampaignFromUtm(
  tenantId: string,
  utmCampaign?: string | null,
): Promise<{ campaignId: string | null; campaignName: string | null }> {
  const code = utmCampaign?.trim();
  if (!code) return { campaignId: null, campaignName: null };

  const campaign = await prisma.campaign.findFirst({
    where: {
      tenantId,
      status: CampaignStatus.ACTIVE,
      OR: [{ code: code.toLowerCase() }, { name: { equals: code, mode: "insensitive" } }],
    },
    select: { id: true, name: true },
  });

  if (!campaign) return { campaignId: null, campaignName: code };
  return { campaignId: campaign.id, campaignName: campaign.name };
}

export function parseGeoFromHeaders(headers: Headers): {
  ipCountry?: string;
  ipRegion?: string;
  ipCity?: string;
} {
  return {
    ipCountry:
      headers.get("x-country") || headers.get("cf-ipcountry") || headers.get("x-nf-geo-country") || undefined,
    ipRegion: headers.get("x-nf-geo-region") || headers.get("x-region") || undefined,
    ipCity: headers.get("x-nf-geo-city") || headers.get("x-city") || undefined,
  };
}

export function parseDeviceFromUserAgent(userAgent?: string): {
  deviceType: string;
  browser: string;
  os: string;
} {
  const ua = (userAgent ?? "").toLowerCase();
  let deviceType = "desktop";
  if (/mobile|android|iphone|ipod/.test(ua)) deviceType = "mobile";
  else if (/ipad|tablet/.test(ua)) deviceType = "tablet";

  let browser = "Other";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome/") && !ua.includes("edg/")) browser = "Chrome";
  else if (ua.includes("safari/") && !ua.includes("chrome/")) browser = "Safari";
  else if (ua.includes("firefox/")) browser = "Firefox";
  else if (ua.includes("instagram")) browser = "Instagram";
  else if (ua.includes("fbav") || ua.includes("facebook")) browser = "Facebook";

  let os = "Other";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("mac os")) os = "Apple";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("windows")) os = "Windows";

  return { deviceType, browser, os };
}
