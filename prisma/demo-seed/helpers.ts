import { CampaignStatus } from "../../src/generated/prisma";
import type { PrismaClient } from "../../src/generated/prisma";

export const DEMO_PACK_CODE = "DEMO_PACK_V2";

export function daysAgo(days: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

export function daysFromNow(days: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

export function monthsFromNow(months: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setMonth(d.getMonth() + months);
  return d;
}

export async function demoPackAlreadyApplied(prisma: PrismaClient, tenantId: string): Promise<boolean> {
  const marker = await prisma.campaign.findFirst({
    where: { tenantId, code: DEMO_PACK_CODE },
    select: { id: true },
  });
  return Boolean(marker);
}

export async function markDemoPackApplied(prisma: PrismaClient, tenantId: string) {
  await prisma.campaign.upsert({
    where: { tenantId_code: { tenantId, code: DEMO_PACK_CODE } },
    create: {
      tenantId,
      name: "Demo data pack v2 (system)",
      code: DEMO_PACK_CODE,
      status: CampaignStatus.PAUSED,
      description: "Marker — full demo dataset applied. Safe to ignore in UI filters.",
    },
    update: {},
  });
}
