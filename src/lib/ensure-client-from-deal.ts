import { PropertyClientStatus } from "@/generated/prisma";
import prisma from "@/lib/db";

/** Create (or return existing) PropertyClient linked to a closed / finance-approved deal. */
export async function ensureClientFromDeal(tenantId: string, dealId: string): Promise<{ clientId: string } | null> {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, tenantId },
    include: {
      lead: { select: { id: true, name: true, email: true, phone: true } },
      unit: { select: { id: true, pricingPlanId: true } },
      propertyClient: { select: { id: true } },
    },
  });
  if (!deal) return null;
  if (deal.propertyClient) return { clientId: deal.propertyClient.id };

  const fullName = deal.lead?.name?.trim() || "Client";

  const client = await prisma.$transaction(async (tx) => {
    const created = await tx.propertyClient.create({
      data: {
        tenantId,
        dealId: deal.id,
        leadId: deal.leadId,
        fullName,
        email: deal.lead?.email || null,
        phone: deal.lead?.phone || null,
        status: PropertyClientStatus.ACTIVE,
      },
    });
    if (deal.unit) {
      const existingLink = await tx.clientUnitLink.findFirst({
        where: { tenantId, clientId: created.id, unitId: deal.unit.id },
        select: { id: true },
      });
      if (!existingLink) {
        await tx.clientUnitLink.create({
          data: {
            tenantId,
            clientId: created.id,
            unitId: deal.unit.id,
            pricingPlanId: deal.unit.pricingPlanId,
          },
        });
      }
    }
    return created;
  });

  return { clientId: client.id };
}
