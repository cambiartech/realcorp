"use server";

import { HrDocumentCategory, HrFormRequestStatus } from "@/generated/prisma";
import {
  createTenantUploadSignature,
  type CloudinaryUploadError,
  type CloudinaryUploadSignature,
} from "@/lib/cloudinary-upload-server";
import prisma from "@/lib/db";
import { loadHrFormRequestByToken } from "@/lib/hr-form-request-loader";
import {
  bankFormSchema,
  biodataFormSchema,
  guarantorFormSchema,
  healthFormSchema,
  printUploadSchema,
} from "@/lib/validators/hr-forms";
import { normalizeBiodataSubmission } from "@/lib/hr-biodata-normalize";
import type { HrFormType } from "@/generated/prisma";
import { revalidatePath } from "next/cache";

type ActionResult = { ok: true } | { ok: false; error: string };

function schemaForType(formType: HrFormType) {
  switch (formType) {
    case "BIODATA":
      return biodataFormSchema;
    case "BANK_FORM":
      return bankFormSchema;
    case "GUARANTOR":
      return guarantorFormSchema;
    case "HEALTH":
      return healthFormSchema;
    default:
      return biodataFormSchema;
  }
}

async function assertWritableRequest(token: string) {
  const loaded = await loadHrFormRequestByToken(token);
  if (!loaded) return { loaded: null as null, error: "This form link is invalid or has expired." };
  if (loaded.status === HrFormRequestStatus.EXPIRED) {
    return { loaded: null, error: "This form link has expired. Ask HR for a new link." };
  }
  if (loaded.status === HrFormRequestStatus.CANCELLED) {
    return { loaded: null, error: "This form request was cancelled." };
  }
  if (loaded.status === HrFormRequestStatus.APPROVED) {
    return { loaded: null, error: "This form was already approved." };
  }
  if (loaded.status === HrFormRequestStatus.SUBMITTED) {
    return { loaded: null, error: "You already submitted this form. HR will review it shortly." };
  }
  return { loaded, error: null as null };
}

export async function submitHrFormOnline(token: string, raw: Record<string, unknown>): Promise<ActionResult> {
  const check = await assertWritableRequest(token);
  if (!check.loaded) return { ok: false, error: check.error! };

  const schema = schemaForType(check.loaded.formType);
  const prepared = check.loaded.formType === "BIODATA" ? normalizeBiodataSubmission(raw) : raw;
  const parsed = schema.safeParse(prepared);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
  }

  await prisma.hrFormRequest.update({
    where: { id: check.loaded.id },
    data: {
      status: HrFormRequestStatus.SUBMITTED,
      submittedAt: new Date(),
      submittedPayload: parsed.data,
    },
  });

  await revalidateHrFormViews(check.loaded.tenantId, check.loaded.bundleToken, token);
  return { ok: true };
}

export async function submitHrFormUpload(
  token: string,
  input: { fileUrl: string; fileName?: string },
): Promise<ActionResult> {
  const check = await assertWritableRequest(token);
  if (!check.loaded) return { ok: false, error: check.error! };

  const parsed = printUploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid file." };

  await prisma.hrFormRequest.update({
    where: { id: check.loaded.id },
    data: {
      status: HrFormRequestStatus.SUBMITTED,
      submittedAt: new Date(),
      submittedFileUrl: parsed.data.fileUrl,
      submittedFileName: parsed.data.fileName || "Signed form",
    },
  });

  const categoryMap: Partial<Record<HrFormType, HrDocumentCategory>> = {
    BIODATA: "BIODATA",
    BANK_FORM: "BANK_FORM",
    GUARANTOR: "GUARANTOR",
    HEALTH: "OTHER",
  };
  const category = categoryMap[check.loaded.formType] ?? "OTHER";

  if (!check.loaded.employeeProfileId) {
    await revalidateHrFormViews(check.loaded.tenantId, check.loaded.bundleToken, token);
    return { ok: true };
  }

  await prisma.hrDocument.create({
    data: {
      tenantId: check.loaded.tenantId,
      employeeProfileId: check.loaded.employeeProfileId,
      category,
      title: `Uploaded — ${check.loaded.formType}`,
      fileUrl: parsed.data.fileUrl,
      fileName: parsed.data.fileName || "signed-form",
      uploadedByLabel: check.loaded.profile?.fullName || check.loaded.recipientName || "Employee",
    },
  });

  await revalidateHrFormViews(check.loaded.tenantId, check.loaded.bundleToken, token);
  return { ok: true };
}

async function revalidateHrFormViews(tenantId: string, bundleToken: string | null, formToken: string) {
  revalidatePath(`/hr-form/${formToken}`);
  if (bundleToken) revalidatePath(`/hr-onboarding/${bundleToken}`);
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
  if (tenant?.slug) {
    revalidatePath(`/${tenant.slug}/hr/dashboard`);
    revalidatePath(`/${tenant.slug}/hr`);
    revalidatePath(`/${tenant.slug}`);
  }
}

export async function getHrFormUploadSignature(
  token: string,
  input?: { fileName?: string },
): Promise<CloudinaryUploadSignature | CloudinaryUploadError> {
  const check = await assertWritableRequest(token);
  if (!check.loaded) return { ok: false, error: check.error! };

  return createTenantUploadSignature({
    tenantId: check.loaded.tenantId,
    tenantSlug: check.loaded.tenant.slug,
    area: "hr-forms",
    fileName: input?.fileName,
    publicIdPrefix: `${check.loaded.tenantId}/${check.loaded.id}`,
  });
}
