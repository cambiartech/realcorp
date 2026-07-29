import { DealStage, LeadQuality } from "@/generated/prisma";
import prisma from "@/lib/db";

// ---------------------------------------------------------------------------
// Source quality weights (0–20)
// ---------------------------------------------------------------------------
const SOURCE_SCORE: Record<string, number> = {
  Referral: 20,
  "Walk-in": 19,
  Partner: 18,
  Facebook: 17,
  Instagram: 17,
  "Google Ads": 16,
  TikTok: 14,
  WhatsApp: 13,
  Website: 11,
  "Email Campaign": 9,
  "Website Form": 11,
};

// ---------------------------------------------------------------------------
// Deal stage weights (0–20)
// ---------------------------------------------------------------------------
const DEAL_STAGE_SCORE: Record<DealStage, number> = {
  NEW_LEAD: 3,
  CONTACTED: 6,
  QUALIFIED: 9,
  INSPECTION_BOOKED: 12,
  INSPECTION_COMPLETED: 14,
  NEGOTIATION: 16,
  RESERVATION_MADE: 18,
  CLOSED_WON: 20,
  CLOSED_LOST: 0,
};

// ---------------------------------------------------------------------------
// Engagement recency (0–20) based on lastActivityAt
// ---------------------------------------------------------------------------
function recencyScore(lastActivityAt: Date | null): number {
  if (!lastActivityAt) return 0;
  const daysAgo = (Date.now() - lastActivityAt.getTime()) / 86_400_000;
  if (daysAgo <= 1) return 20;
  if (daysAgo <= 3) return 16;
  if (daysAgo <= 7) return 12;
  if (daysAgo <= 14) return 8;
  if (daysAgo <= 30) return 4;
  return 0;
}

// ---------------------------------------------------------------------------
// Core scoring function — accepts a snapshot of lead data
// ---------------------------------------------------------------------------
export type LeadScoreInput = {
  email: string | null;
  phone: string | null;
  projectInterest: string | null;
  budgetRange: string | null;
  source: string | null;
  lastActivityAt: Date | null;
  bestDealStage: DealStage | null;
};

export type ScoreBreakdown = {
  contact: number;
  profile: number;
  source: number;
  recency: number;
  dealProgress: number;
  total: number;
};

export function computeLeadScore(input: LeadScoreInput): ScoreBreakdown {
  const contact = (input.email ? 10 : 0) + (input.phone ? 10 : 0);
  const profile = (input.projectInterest ? 10 : 0) + (input.budgetRange ? 10 : 0);
  const source = input.source
    ? (SOURCE_SCORE[input.source] ?? 6) // unknown source gets 6
    : 0;
  const recency = recencyScore(input.lastActivityAt);
  const dealProgress = input.bestDealStage !== null ? (DEAL_STAGE_SCORE[input.bestDealStage] ?? 0) : 0;

  const total = Math.min(100, contact + profile + source + recency + dealProgress);
  return { contact, profile, source, recency, dealProgress, total };
}

export function scoreToQuality(score: number): LeadQuality {
  if (score >= 70) return LeadQuality.HOT;
  if (score >= 40) return LeadQuality.WARM;
  return LeadQuality.COLD;
}

// ---------------------------------------------------------------------------
// Persist — recalculate a lead's score and auto-update quality
// ---------------------------------------------------------------------------
export async function recalculateLeadScore(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      email: true,
      phone: true,
      projectInterest: true,
      budgetRange: true,
      source: true,
      lastActivityAt: true,
      deals: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { stage: true },
      },
    },
  });
  if (!lead) return;

  // Pick the "best" deal stage (highest progress, ignoring CLOSED_LOST)
  const bestStage =
    lead.deals
      .map((d) => d.stage)
      .sort((a, b) => (DEAL_STAGE_SCORE[b] ?? 0) - (DEAL_STAGE_SCORE[a] ?? 0))[0] ?? null;

  const breakdown = computeLeadScore({
    email: lead.email,
    phone: lead.phone,
    projectInterest: lead.projectInterest,
    budgetRange: lead.budgetRange,
    source: lead.source,
    lastActivityAt: lead.lastActivityAt,
    bestDealStage: bestStage,
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      score: breakdown.total,
      quality: scoreToQuality(breakdown.total),
    },
  });
}

// ---------------------------------------------------------------------------
// Touch lastActivityAt — called after any activity is logged
// ---------------------------------------------------------------------------
export async function touchLeadActivity(leadId: string): Promise<void> {
  await prisma.lead.update({
    where: { id: leadId },
    data: { lastActivityAt: new Date() },
  });
  await recalculateLeadScore(leadId);
}
