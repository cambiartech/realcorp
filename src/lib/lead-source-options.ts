export const DEFAULT_LEAD_SOURCES = [
  "Website",
  "Instagram",
  "Facebook",
  "Google Ads",
  "TikTok",
  "Referral",
  "Walk-in",
  "Partner",
  "Email Campaign",
  "WhatsApp",
] as const;

export function buildLeadSourceOptions(existingSources: Array<string | null | undefined>) {
  const set = new Set<string>(DEFAULT_LEAD_SOURCES);
  for (const source of existingSources) {
    const clean = source?.trim();
    if (clean) set.add(clean);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
