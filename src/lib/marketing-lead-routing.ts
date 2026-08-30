import { MarketingLeadRouting } from "@/generated/prisma";

export const SALES_VISIBLE_LEAD = { salesVisible: true } as const;
export const MARKETING_HELD_LEAD = { salesVisible: false } as const;

export function inboundLeadIsSalesVisible(
  routing: MarketingLeadRouting | string | null | undefined,
): boolean {
  return routing !== MarketingLeadRouting.MARKETING_HOLD && routing !== "MARKETING_HOLD";
}

export function inboundLeadVisibilityData(
  routing: MarketingLeadRouting | string | null | undefined,
): { salesVisible: boolean; salesReleasedAt: Date | null } {
  const salesVisible = inboundLeadIsSalesVisible(routing);
  return {
    salesVisible,
    salesReleasedAt: salesVisible ? new Date() : null,
  };
}
