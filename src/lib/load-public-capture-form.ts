import { LeadCaptureFormStatus } from "@/generated/prisma";
import { parseCaptureFormFields } from "@/lib/capture-form-types";
import prisma from "@/lib/db";

export async function loadPublicCaptureForm(tenantSlug: string, formSlug: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      name: true,
      settings: { select: { logoUrl: true, accentColor: true, primaryColor: true } },
    },
  });
  if (!tenant) return null;

  const form = await prisma.leadCaptureForm.findFirst({
    where: {
      slug: formSlug,
      status: LeadCaptureFormStatus.ACTIVE,
      tenant: { slug: tenantSlug },
    },
    select: {
      title: true,
      description: true,
      thankYouMessage: true,
      fields: true,
    },
  });
  if (!form) return null;

  const projects = await prisma.project.findMany({
    where: { tenant: { slug: tenantSlug } },
    select: { name: true },
    orderBy: { name: "asc" },
    take: 100,
  });

  return {
    tenantSlug,
    formSlug,
    title: form.title,
    description: form.description,
    thankYouMessage: form.thankYouMessage,
    fields: parseCaptureFormFields(form.fields),
    projectOptions: projects.map((p) => p.name),
    brand: {
      tenantName: tenant.name,
      logoUrl: tenant.settings?.logoUrl ?? null,
      accentColor: tenant.settings?.accentColor ?? tenant.settings?.primaryColor ?? null,
    },
  };
}
