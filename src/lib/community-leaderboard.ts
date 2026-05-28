export type CommunityLeaderboardPeriod = "month" | "quarter" | "year";

export type CommunityMemberLeaderboardEntry = {
  partnerId: string;
  name: string;
  company: string | null;
  territory: string | null;
  prospectsSubmitted: number;
  referrals: number;
  hotProspects: number;
  dealsWon: number;
  dealValue: number;
  compositeScore: number;
};

function periodBounds(period: CommunityLeaderboardPeriod, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === "month") {
    start.setDate(1);
  } else if (period === "quarter") {
    const q = Math.floor(start.getMonth() / 3);
    start.setMonth(q * 3, 1);
  } else {
    start.setMonth(0, 1);
  }

  const end = new Date(start);
  if (period === "month") end.setMonth(end.getMonth() + 1);
  else if (period === "quarter") end.setMonth(end.getMonth() + 3);
  else end.setFullYear(end.getFullYear() + 1);

  return { start, end };
}

function periodLabel(period: CommunityLeaderboardPeriod, now = new Date()) {
  if (period === "month") {
    return new Intl.DateTimeFormat("en-NG", { month: "long", year: "numeric" }).format(now);
  }
  if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3) + 1;
    return `Q${q} ${now.getFullYear()}`;
  }
  return String(now.getFullYear());
}

function isReferralSource(source: string | null | undefined) {
  if (!source) return false;
  return source.toLowerCase().includes("referral");
}

function computeMemberScore(input: {
  prospectsSubmitted: number;
  referrals: number;
  hotProspects: number;
  dealsWon: number;
  dealValue: number;
}) {
  const submissionPoints = input.prospectsSubmitted * 5 + input.referrals * 12;
  const qualityPoints = input.hotProspects * 4;
  const winPoints = input.dealsWon * 30 + Math.min(Math.round(input.dealValue / 10_000_000), 50);
  return submissionPoints + qualityPoints + winPoints;
}

/** Rank external community members (realtor partners) — not internal staff. */
export function buildCommunityMemberLeaderboard(input: {
  period: CommunityLeaderboardPeriod;
  partners: Array<{
    id: string;
    displayName: string;
    company: string | null;
    territory: string | null;
    isActive: boolean;
  }>;
  leads: Array<{
    realtorPartnerId: string | null;
    source: string | null;
    quality: string;
    createdAt: Date;
  }>;
  deals: Array<{
    stage: string;
    value: unknown;
    updatedAt: Date;
    lead: { realtorPartnerId: string | null } | null;
  }>;
  now?: Date;
}): { label: string; entries: CommunityMemberLeaderboardEntry[] } {
  const now = input.now ?? new Date();
  const { start, end } = periodBounds(input.period, now);
  const label = periodLabel(input.period, now);

  const meta = new Map(
    input.partners.map((p) => [
      p.id,
      { name: p.displayName, company: p.company, territory: p.territory, isActive: p.isActive },
    ]),
  );

  const bucket = new Map<
    string,
    {
      prospectsSubmitted: number;
      referrals: number;
      hotProspects: number;
      dealsWon: number;
      dealValue: number;
    }
  >();

  function ensure(partnerId: string) {
    if (!bucket.has(partnerId)) {
      bucket.set(partnerId, {
        prospectsSubmitted: 0,
        referrals: 0,
        hotProspects: 0,
        dealsWon: 0,
        dealValue: 0,
      });
    }
    return bucket.get(partnerId)!;
  }

  for (const lead of input.leads) {
    if (!lead.realtorPartnerId) continue;
    if (lead.createdAt < start || lead.createdAt >= end) continue;
    const row = ensure(lead.realtorPartnerId);
    if (isReferralSource(lead.source)) {
      row.referrals += 1;
    } else {
      row.prospectsSubmitted += 1;
    }
    if (lead.quality === "HOT") row.hotProspects += 1;
  }

  for (const deal of input.deals) {
    const partnerId = deal.lead?.realtorPartnerId;
    if (!partnerId || deal.stage !== "CLOSED_WON") continue;
    if (deal.updatedAt < start || deal.updatedAt >= end) continue;
    const row = ensure(partnerId);
    row.dealsWon += 1;
    row.dealValue += Number(deal.value || 0);
  }

  const entries: CommunityMemberLeaderboardEntry[] = Array.from(bucket.entries())
    .map(([partnerId, stats]) => {
      const info = meta.get(partnerId);
      return {
        partnerId,
        name: info?.name || "Community member",
        company: info?.company ?? null,
        territory: info?.territory ?? null,
        ...stats,
        compositeScore: computeMemberScore(stats),
      };
    })
    .filter((e) => e.compositeScore > 0)
    .sort(
      (a, b) =>
        b.compositeScore - a.compositeScore ||
        b.dealsWon - a.dealsWon ||
        b.prospectsSubmitted + b.referrals - (a.prospectsSubmitted + a.referrals) ||
        a.name.localeCompare(b.name),
    );

  return { label, entries };
}

export function formatLeaderboardMoney(value: number, currency = "NGN") {
  if (value <= 0) return "—";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    notation: value >= 100_000_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 100_000_000 ? 1 : 0,
  }).format(value);
}
