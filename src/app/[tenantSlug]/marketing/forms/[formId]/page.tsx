import { auth } from "@/auth";
import { aggregateCaptureFormAnalytics } from "@/lib/capture-form-analytics";
import { parseCaptureFormFields } from "@/lib/capture-form-types";
import { assertTenantNavAccess, MEMBERSHIP_FOR_NAV_SELECT } from "@/lib/guard-tenant-nav";
import { canEditMarketing } from "@/lib/marketing-access";
import prisma from "@/lib/db";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CaptureFormDetailClient } from "@/components/capture-forms/capture-form-detail-client";

export const dynamic = "force-dynamic";

export default async function CaptureFormDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; formId: string }>;
}) {
  const { tenantSlug, formId } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      slug: true,
      settings: {
        select: {
          moduleSales: true,
          moduleFinance: true,
          moduleMarketing: true,
          moduleCommunity: true,
          roleModuleGrants: true,
        },
      },
    },
  });
  if (!tenant) notFound();

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: MEMBERSHIP_FOR_NAV_SELECT,
  });
  assertTenantNavAccess(session, membership, tenant.settings, "marketing");

  const form = await prisma.leadCaptureForm.findFirst({
    where: { id: formId, tenantId: tenant.id },
    include: {
      campaign: { select: { id: true, name: true, code: true } },
      realtorPartner: { select: { id: true, displayName: true } },
    },
  });
  if (!form) notFound();

  const [sessions, campaigns, partners, projects] = await Promise.all([
    prisma.leadCaptureFormSession.findMany({
      where: { formId: form.id },
      select: {
        status: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        utmContent: true,
        utmTerm: true,
        localHour: true,
        lastFieldKey: true,
        completionPct: true,
        deviceType: true,
        browser: true,
        ipCountry: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    }),
    prisma.campaign.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.realtorPartner.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.project.findMany({
      where: { tenantId: tenant.id },
      select: { name: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
  ]);

  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") || "http";
  const siteOrigin = `${proto}://${host}`;

  const analytics = aggregateCaptureFormAnalytics(sessions, {
    viewCount: form.viewCount,
    startCount: form.startCount,
    submitCount: form.submitCount,
  });

  const canEdit = canEditMarketing(Boolean(session.user.isPlatformAdmin), membership);

  return (
    <CaptureFormDetailClient
      tenantSlug={tenantSlug}
      canEdit={canEdit}
      currentUserId={session.user.id}
      siteOrigin={siteOrigin}
      form={{
        id: form.id,
        name: form.name,
        slug: form.slug,
        title: form.title,
        description: form.description,
        status: form.status,
        thankYouMessage: form.thankYouMessage,
        redirectUrl: form.redirectUrl,
        defaultSource: form.defaultSource,
        campaignId: form.campaignId,
        realtorPartnerId: form.realtorPartnerId,
        autoWhatsAppEnabled: form.autoWhatsAppEnabled,
        autoWhatsAppMessage: form.autoWhatsAppMessage,
        campaignLabel: form.campaign ? `${form.campaign.name} (${form.campaign.code})` : null,
        partnerName: form.realtorPartner?.displayName ?? null,
        fields: parseCaptureFormFields(form.fields),
      }}
      analytics={analytics}
      campaigns={campaigns}
      partners={partners}
      projectOptions={projects.map((p) => p.name)}
    />
  );
}
