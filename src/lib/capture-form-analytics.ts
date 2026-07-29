import { LeadCaptureSessionStatus } from "@/generated/prisma";

type SessionSlice = {
  status: LeadCaptureSessionStatus;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  localHour: number | null;
  lastFieldKey: string | null;
  completionPct: number;
  deviceType: string | null;
  browser: string | null;
  ipCountry: string | null;
  createdAt: Date;
};

function countByKey(rows: SessionSlice[], pick: (r: SessionSlice) => string | null | undefined) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = pick(row)?.trim();
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

export function aggregateCaptureFormAnalytics(
  sessions: SessionSlice[],
  form: {
    viewCount: number;
    startCount: number;
    submitCount: number;
  },
) {
  const partials = sessions.filter(
    (s) =>
      s.status === LeadCaptureSessionStatus.PARTIAL ||
      s.status === LeadCaptureSessionStatus.ABANDONED ||
      (s.status === LeadCaptureSessionStatus.STARTED && s.completionPct > 0),
  ).length;

  const hourBuckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: sessions.filter((s) => s.localHour === hour).length,
  })).filter((b) => b.count > 0);

  const peakHour = hourBuckets.sort((a, b) => b.count - a.count)[0]?.hour ?? null;

  return {
    funnel: {
      views: form.viewCount,
      starts: form.startCount,
      partials,
      submits: form.submitCount,
      viewToStartPct: form.viewCount > 0 ? Math.round((form.startCount / form.viewCount) * 100) : 0,
      startToSubmitPct: form.startCount > 0 ? Math.round((form.submitCount / form.startCount) * 100) : 0,
    },
    utm: {
      bySource: countByKey(sessions, (s) => s.utmSource),
      byMedium: countByKey(sessions, (s) => s.utmMedium),
      byCampaign: countByKey(sessions, (s) => s.utmCampaign),
      byContent: countByKey(sessions, (s) => s.utmContent),
      byTerm: countByKey(sessions, (s) => s.utmTerm),
    },
    hourBuckets,
    peakHour,
    abandonByField: countByKey(
      sessions.filter(
        (s) =>
          s.status === LeadCaptureSessionStatus.ABANDONED || s.status === LeadCaptureSessionStatus.PARTIAL,
      ),
      (s) => s.lastFieldKey,
    ),
    deviceBreakdown: countByKey(sessions, (s) => s.deviceType),
    browserBreakdown: countByKey(sessions, (s) => s.browser),
    countryBreakdown: countByKey(sessions, (s) => s.ipCountry),
  };
}

export const UTM_PARAM_HELP: Record<string, string> = {
  utm_source: "Platform or site (instagram, facebook, google, newsletter)",
  utm_medium: "Channel type (bio, cpc, email, social, referral)",
  utm_campaign: "Campaign name — matches Marketing campaign code when possible",
  utm_content: "Ad/link variant (reel-bio vs story-link, A/B test label)",
  utm_term: "Paid keyword (optional; common on Google Ads)",
};
