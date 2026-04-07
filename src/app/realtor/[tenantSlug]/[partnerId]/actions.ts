"use server";

import { CampaignStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import { verifyPortalToken } from "@/lib/portal-token";
import { parsePortalLeadForm } from "@/lib/validators/portal-lead";
import { revalidatePath } from "next/cache";

export type PortalSubmitResult = { ok: true } | { ok: false; error: string };

export async function submitPortalLead(
  tenantSlug: string,
  partnerId: string,
  accessToken: string,
  _prev: PortalSubmitResult | null,
  formData: FormData,
): Promise<PortalSubmitResult> {
  const parsed = parsePortalLeadForm(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, name: true },
  });
  if (!tenant) return { ok: false, error: "Workspace not found." };

  const partner = await prisma.realtorPartner.findFirst({
    where: { id: partnerId, tenantId: tenant.id, isActive: true },
    select: { id: true, displayName: true, portalTokenHash: true },
  });
  if (!partner || !verifyPortalToken(accessToken, partner.portalTokenHash)) {
    return { ok: false, error: "Invalid or expired portal link. Ask your developer contact for a new link." };
  }

  let campaignId: string | null = null;
  let campaignName: string | null = null;
  const utmCampaign = parsed.data.utmCampaign;
  if (utmCampaign) {
    const campaign = await prisma.campaign.findFirst({
      where: {
        tenantId: tenant.id,
        OR: [{ code: utmCampaign.toLowerCase() }, { name: { equals: utmCampaign, mode: "insensitive" } }],
        status: CampaignStatus.ACTIVE,
      },
      select: { id: true, name: true },
    });
    if (campaign) {
      campaignId = campaign.id;
      campaignName = campaign.name;
    }
  }

  try {
    await prisma.lead.create({
      data: {
        tenantId: tenant.id,
        name: parsed.data.name,
        email: parsed.data.email ?? null,
        phone: parsed.data.phone ?? null,
        source: `Realtor: ${partner.displayName}`,
        campaignName,
        campaignId,
        utmSource: parsed.data.utmSource ?? null,
        utmMedium: parsed.data.utmMedium ?? null,
        utmCampaign: parsed.data.utmCampaign ?? null,
        realtorPartnerId: partner.id,
        projectInterest: parsed.data.projectInterest ?? null,
        budgetRange: parsed.data.budgetRange ?? null,
        quality: parsed.data.quality,
      },
    });
  } catch {
    return { ok: false, error: "Could not submit lead. Try again shortly." };
  }

  revalidatePath(`/realtor/${tenantSlug}/${partnerId}`);
  return { ok: true };
}
