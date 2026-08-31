import { HrFormRequestStatus, type HrFormType } from "@/generated/prisma";
import prisma from "@/lib/db";
import { prefillValuesForForm } from "@/lib/hr-form-prefill";
import { HR_FORM_TYPE_LABELS, sortFormTypes } from "@/lib/hr-form-types";
import { parsePensionAdministrators } from "@/lib/org-pension-administrators";
import { brandingFromSettings } from "@/lib/tenant-branding";

export async function loadHrFormBundleByToken(bundleToken: string) {
  const requests = await prisma.hrFormRequest.findMany({
    where: { bundleToken },
    include: {
      profile: true,
      tenant: {
        select: {
          name: true,
          slug: true,
          settings: {
            select: {
              logoUrl: true,
              primaryColor: true,
              accentColor: true,
              orgEmail: true,
              orgPhone: true,
              orgAddressLine: true,
              orgCity: true,
              orgState: true,
              orgCountry: true,
              pensionAdministrators: true,
            },
          },
        },
      },
    },
  });

  if (requests.length === 0) return null;

  const now = new Date();
  const latestByType = new Map<string, (typeof requests)[0]>();
  for (const r of requests) {
    const prev = latestByType.get(r.formType);
    if (!prev || r.createdAt > prev.createdAt) latestByType.set(r.formType, r);
  }
  const deduped = [...latestByType.values()];

  const steps = sortFormTypes(deduped.map((r) => r.formType)).map((formType) => {
    const req = deduped.find((r) => r.formType === formType)!;
    let status = req.status;
    if (status === HrFormRequestStatus.PENDING && req.expiresAt < now) {
      status = HrFormRequestStatus.EXPIRED;
    }
    const initialValues = req.profile
      ? prefillValuesForForm(req.profile)
      : {
          fullName: req.recipientName || "",
          workEmail: req.recipientEmail || "",
          phoneMobile: "",
        };
    if (!initialValues.workEmail && req.recipientEmail) {
      initialValues.workEmail = req.recipientEmail;
    }
    return {
      id: req.id,
      formType: req.formType as HrFormType,
      formTypeLabel: HR_FORM_TYPE_LABELS[req.formType],
      token: req.token,
      status,
      deliveryMode: req.deliveryMode,
      initialValues,
      printPath: `/hr-form/${req.token}/print`,
    };
  });

  for (const req of deduped) {
    if (req.status === HrFormRequestStatus.PENDING && req.expiresAt < now) {
      await prisma.hrFormRequest.update({
        where: { id: req.id },
        data: { status: HrFormRequestStatus.EXPIRED },
      });
    }
  }

  const first = deduped[0]!;
  const tenant = await prisma.tenant.findUnique({
    where: { id: first.tenantId },
    select: {
      slug: true,
      name: true,
      settings: {
        select: {
          logoUrl: true,
          primaryColor: true,
          accentColor: true,
          orgEmail: true,
          orgPhone: true,
          orgAddressLine: true,
          orgCity: true,
          orgState: true,
          orgCountry: true,
          pensionAdministrators: true,
        },
      },
    },
  });
  if (!tenant?.slug) return null;

  const brand = brandingFromSettings(tenant.name, tenant.settings);
  const allExpired = steps.every((s) => s.status === HrFormRequestStatus.EXPIRED);
  const allDone = steps.every(
    (s) => s.status === HrFormRequestStatus.SUBMITTED || s.status === HrFormRequestStatus.APPROVED,
  );

  return {
    bundleToken,
    tenantSlug: tenant.slug,
    brand,
    employeeName: first.profile?.fullName || first.recipientName || "",
    hrNote: first.hrNote,
    expiresAt: first.expiresAt,
    steps,
    allExpired,
    allDone,
    pensionAdministrators: parsePensionAdministrators(tenant.settings?.pensionAdministrators),
  };
}
