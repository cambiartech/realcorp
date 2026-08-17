"use server";

import { randomBytes } from "crypto";
import { auth } from "@/auth";
import {
  EmployeeProfileStatus,
  HrDocumentCategory,
  HrFormDeliveryMode,
  HrFormRequestStatus,
  HrFormType,
  MembershipStatus,
} from "@/generated/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import prisma from "@/lib/db";
import { canManageHr } from "@/lib/hr-access";
import { extractHrDocument, GeminiRateLimitError } from "@/lib/hr-document-extractor";
import { ensureEmployeeNumber } from "@/lib/hr-employee-number";
import { mergeHrFormIntoProfile } from "@/lib/hr-form-merge";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const intakeSchema = z.object({
  fileUrl: z.string().url(),
  fileName: z.string().trim().min(1).max(200),
  fileBase64: z.string().max(21_000_000).optional(),
  fileMimeType: z.string().trim().max(120).optional(),
  category: z.union([z.nativeEnum(HrDocumentCategory), z.literal("AUTO")]),
  preferredProfileId: z.string().trim().optional(),
  preferredUserId: z.string().trim().optional(),
  skipDocumentCreate: z.boolean().optional(),
});

const createHrOnlySchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  workEmail: z.string().trim().email().optional().or(z.literal("")),
  phoneMobile: z.string().trim().max(40).optional(),
  position: z.string().trim().max(120).optional(),
  department: z.string().trim().max(80).optional(),
  paygroupName: z.string().trim().max(80).optional(),
  grossMonthly: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().positive().optional(),
  ),
});

async function hrContext(tenantSlug: string, options?: { requireAi?: boolean }) {
  const session = await auth();
  if (!session?.user?.id) return { error: "You must be signed in." } as const;
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, settings: { select: { moduleAi: true, payrollCountryCode: true } } },
  });
  if (!tenant) return { error: "Organization not found." } as const;
  if (options?.requireAi && !tenant.settings?.moduleAi) {
    return { error: "AI Assistant is not enabled for this organization." } as const;
  }
  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { role: true, status: true },
  });
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return { error: "You do not have permission to manage HR records." } as const;
  }
  return { session, tenant } as const;
}

function normalize(value: string | null | undefined) {
  return (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function nameScore(a: string, b: string) {
  const aa = new Set(normalize(a).split(" ").filter(Boolean));
  const bb = new Set(normalize(b).split(" ").filter(Boolean));
  if (!aa.size || !bb.size) return 0;
  let overlap = 0;
  for (const token of aa) if (bb.has(token)) overlap += 1;
  return (2 * overlap) / (aa.size + bb.size);
}

type IntakeProfile = {
  id: string;
  userId: string;
  fullName: string | null;
  workEmail: string | null;
  employeeNumber: string | null;
};

type ProfileMatch = {
  profile: IntakeProfile;
  matchedBy: string;
};

async function matchProfile(
  tenantId: string,
  extracted: { employeeName: string; employeeEmail: string; employeeNumber: string },
  preferredProfileId?: string,
  preferredUserId?: string,
  skipStrictMatch?: boolean,
): Promise<ProfileMatch | { conflict: string } | null> {
  const profiles = await prisma.employeeProfile.findMany({
    where: { tenantId },
    select: { id: true, userId: true, fullName: true, workEmail: true, employeeNumber: true },
  });
  const email = normalize(extracted.employeeEmail);
  const employeeNumber = normalize(extracted.employeeNumber);
  const fullName = normalize(extracted.employeeName);
  let preferred = preferredProfileId
    ? profiles.find((profile) => profile.id === preferredProfileId)
    : preferredUserId
      ? profiles.find((profile) => profile.userId === preferredUserId)
      : undefined;
  if (preferredProfileId && !preferred) {
    return { conflict: "The selected employee record could not be found in this organization." } as const;
  }

  if (!preferred && preferredUserId) {
    const member = await prisma.membership.findFirst({
      where: { tenantId, userId: preferredUserId, status: MembershipStatus.ACTIVE },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!member) return { conflict: "The selected employee is no longer an active organization member." } as const;
    preferred = await prisma.employeeProfile.upsert({
      where: { tenantId_userId: { tenantId, userId: preferredUserId } },
      create: {
        tenantId,
        userId: preferredUserId,
        status: EmployeeProfileStatus.DRAFT,
        fullName: member.user.name || extracted.employeeName || member.user.email || "Team member",
        workEmail: member.user.email || extracted.employeeEmail || null,
      },
      update: {},
      select: { id: true, userId: true, fullName: true, workEmail: true, employeeNumber: true },
    });
    await ensureEmployeeNumber(preferred.id);
  }

  let detected: ProfileMatch | undefined;
  if (email) {
    const exact = profiles.find((profile) => normalize(profile.workEmail) === email);
    if (exact) detected = { profile: exact, matchedBy: "email" };
  }
  if (!detected && employeeNumber) {
    const exact = profiles.find((profile) => normalize(profile.employeeNumber) === employeeNumber);
    if (exact) detected = { profile: exact, matchedBy: "employee number" };
  }
  if (!detected && fullName) {
    const exact = profiles.find((profile) => normalize(profile.fullName) === fullName);
    if (exact) detected = { profile: exact, matchedBy: "name" };
    const ranked = profiles
      .map((profile) => ({ profile, score: nameScore(profile.fullName || "", extracted.employeeName) }))
      .sort((a, b) => b.score - a.score);
    if (
      !detected &&
      ranked[0] &&
      ranked[0].score >= 0.86 &&
      (!ranked[1] || ranked[0].score - ranked[1].score >= 0.15)
    ) {
      detected = { profile: ranked[0].profile, matchedBy: "close name" };
    }
  }

  if (preferred) {
    if (!skipStrictMatch) {
      if (detected && detected.profile.id !== preferred.id) {
        return {
          conflict: `This file appears to belong to ${detected.profile.fullName || "another employee"}, not ${
            preferred.fullName || "the selected employee"
          }. Nothing was filed. Check the file or change the employee selection.`,
        } as const;
      }
      if (
        extracted.employeeName.trim() &&
        preferred.fullName &&
        nameScore(preferred.fullName, extracted.employeeName) < 0.4
      ) {
        return {
          conflict: `The name detected in this file (${extracted.employeeName}) does not match the selected employee (${preferred.fullName}). Nothing was filed.`,
        } as const;
      }
    }
    return { profile: preferred, matchedBy: "HR selection" } as const;
  }
  return detected ?? null;
}

async function createDraftProfile(
  tenantId: string,
  extracted: { employeeName: string; employeeEmail: string; employeeNumber: string },
) {
  if (!extracted.employeeName.trim()) return null;
  const email = extracted.employeeEmail.trim().toLowerCase() || null;
  const user = email
    ? await prisma.user.upsert({
        where: { email },
        create: { name: extracted.employeeName, email },
        update: {},
        select: { id: true },
      })
    : await prisma.user.create({ data: { name: extracted.employeeName }, select: { id: true } });
  const existing = await prisma.employeeProfile.findUnique({
    where: { tenantId_userId: { tenantId, userId: user.id } },
    select: { id: true, userId: true, fullName: true, workEmail: true, employeeNumber: true },
  });
  if (existing) return existing;
  const profile = await prisma.employeeProfile.create({
    data: {
      tenantId,
      userId: user.id,
      status: EmployeeProfileStatus.DRAFT,
      fullName: extracted.employeeName,
      workEmail: email,
      employeeNumber: extracted.employeeNumber || null,
      hrNotes: "Created from document intake; no software access has been granted.",
    },
    select: { id: true, userId: true, fullName: true, workEmail: true, employeeNumber: true },
  });
  await ensureEmployeeNumber(profile.id);
  return profile;
}

export async function ingestHrDocument(
  tenantSlug: string,
  input: unknown,
): Promise<
  | {
      ok: true;
      personName: string;
      matchedBy: string;
      confidence: number;
      requestId: string;
      category: HrDocumentCategory;
    }
  | { ok: false; error: string }
> {
  const ctx = await hrContext(tenantSlug, { requireAi: true });
  if ("error" in ctx) return { ok: false, error: ctx.error || "You do not have permission." };
  const parsed = intakeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Invalid file." };

  try {
    const extracted = await extractHrDocument(parsed.data);
    let match = await matchProfile(
      ctx.tenant.id,
      extracted,
      parsed.data.preferredProfileId,
      parsed.data.preferredUserId,
      parsed.data.skipDocumentCreate,
    );
    if (match && "conflict" in match) return { ok: false, error: match.conflict };
    if (!match) {
      const profile = await createDraftProfile(ctx.tenant.id, extracted);
      if (profile) match = { profile, matchedBy: "new HR-only employee" };
    }
    if (!match) {
      return {
        ok: false,
        error: "No employee identity was found. Select the employee and upload again, or add them first.",
      };
    }

    if (!extracted.formType) {
      if (parsed.data.skipDocumentCreate) {
        revalidatePath(`/${tenantSlug}/hr`);
        return {
          ok: true,
          personName: match.profile.fullName || extracted.employeeName,
          matchedBy: match.matchedBy,
          confidence: extracted.confidence,
          requestId: match.profile.id,
          category: extracted.category,
        };
      }
      const document = await prisma.hrDocument.create({
        data: {
          tenantId: ctx.tenant.id,
          employeeProfileId: match.profile.id,
          category: extracted.category,
          title: parsed.data.fileName.replace(/\.[^/.]+$/, ""),
          fileUrl: parsed.data.fileUrl,
          fileName: parsed.data.fileName,
          uploadedByUserId: ctx.session.user.id,
          uploadedByLabel: ctx.session.user.name || ctx.session.user.email || "HR",
        },
      });
      await writeAuditLog({
        tenantId: ctx.tenant.id,
        actorUserId: ctx.session.user.id,
        actorLabel: ctx.session.user.name || ctx.session.user.email,
        module: "HR",
        entityType: "HrDocument",
        entityId: document.id,
        action: "DOCUMENT_AUTO_CLASSIFIED",
        summary: `${parsed.data.fileName} filed as ${extracted.category} for ${
          match.profile.fullName || extracted.employeeName
        }`,
        metadata: { category: extracted.category, matchedBy: match.matchedBy, confidence: extracted.confidence },
      });
      revalidatePath(`/${tenantSlug}/hr`);
      return {
        ok: true,
        personName: match.profile.fullName || extracted.employeeName,
        matchedBy: match.matchedBy,
        confidence: extracted.confidence,
        requestId: document.id,
        category: extracted.category,
      };
    }

    const request = await prisma.hrFormRequest.create({
      data: {
        tenantId: ctx.tenant.id,
        employeeProfileId: match.profile.id,
        recipientName: match.profile.fullName || extracted.employeeName,
        recipientEmail: match.profile.workEmail || extracted.employeeEmail || null,
        formType: extracted.formType,
        deliveryMode: HrFormDeliveryMode.PRINT_UPLOAD,
        status: HrFormRequestStatus.SUBMITTED,
        token: randomBytes(24).toString("base64url"),
        hrNote: `AI document intake · ${extracted.category} · matched by ${match.matchedBy} · confidence ${Math.round(
          extracted.confidence * 100,
        )}%`,
        submittedPayload: extracted.payload,
        submittedFileUrl: parsed.data.fileUrl,
        submittedFileName: parsed.data.fileName,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        submittedAt: new Date(),
        createdByUserId: ctx.session.user.id,
        createdByLabel: ctx.session.user.name || ctx.session.user.email || "HR",
      },
    });
    await writeAuditLog({
      tenantId: ctx.tenant.id,
      actorUserId: ctx.session.user.id,
      actorLabel: ctx.session.user.name || ctx.session.user.email,
      module: "HR",
      entityType: "HrFormRequest",
      entityId: request.id,
      action: "DOCUMENT_EXTRACTED",
      summary: `${parsed.data.fileName} extracted for ${match.profile.fullName || extracted.employeeName}`,
      metadata: {
        category: extracted.category,
        matchedBy: match.matchedBy,
        confidence: extracted.confidence,
      },
    });
    revalidatePath(`/${tenantSlug}/hr`);
    revalidatePath(`/${tenantSlug}/hr/people`);
    return {
      ok: true,
      personName: match.profile.fullName || extracted.employeeName,
      matchedBy: match.matchedBy,
      confidence: extracted.confidence,
      requestId: request.id,
      category: extracted.category,
    };
  } catch (error) {
    if (error instanceof GeminiRateLimitError) return { ok: false, error: error.message };
    return { ok: false, error: error instanceof Error ? error.message : "Could not extract this document." };
  }
}

export async function createHrOnlyEmployee(
  tenantSlug: string,
  input: unknown,
): Promise<{ ok: true; profileId: string } | { ok: false; error: string }> {
  const ctx = await hrContext(tenantSlug);
  if ("error" in ctx) return { ok: false, error: ctx.error || "You do not have permission." };
  const parsed = createHrOnlySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message || "Invalid employee." };
  const email = parsed.data.workEmail?.trim().toLowerCase() || null;
  try {
    const user = email
      ? await prisma.user.upsert({
          where: { email },
          create: { email, name: parsed.data.fullName },
          update: {},
          select: { id: true },
        })
      : await prisma.user.create({ data: { name: parsed.data.fullName }, select: { id: true } });
    const membership = await prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId: ctx.tenant.id, userId: user.id } },
      select: { status: true },
    });
    const profile = await prisma.employeeProfile.upsert({
      where: { tenantId_userId: { tenantId: ctx.tenant.id, userId: user.id } },
      create: {
        tenantId: ctx.tenant.id,
        userId: user.id,
        fullName: parsed.data.fullName,
        workEmail: email,
        phoneMobile: parsed.data.phoneMobile || null,
        position: parsed.data.position || null,
        department: parsed.data.department || null,
        paygroupName: parsed.data.paygroupName || null,
        grossMonthly: parsed.data.grossMonthly,
        payrollCountryCode: ctx.tenant.settings?.payrollCountryCode || "NG",
        status: EmployeeProfileStatus.ACTIVE,
        hrNotes: membership?.status === MembershipStatus.ACTIVE ? null : "HR/payroll record only; no login access.",
      },
      update: {
        fullName: parsed.data.fullName,
        workEmail: email,
        phoneMobile: parsed.data.phoneMobile || null,
        position: parsed.data.position || null,
        department: parsed.data.department || null,
        paygroupName: parsed.data.paygroupName || null,
        grossMonthly: parsed.data.grossMonthly,
      },
    });
    await ensureEmployeeNumber(profile.id);
    await writeAuditLog({
      tenantId: ctx.tenant.id,
      actorUserId: ctx.session.user.id,
      actorLabel: ctx.session.user.name || ctx.session.user.email,
      module: "HR",
      entityType: "EmployeeProfile",
      entityId: profile.id,
      action: "HR_ONLY_EMPLOYEE_CREATED",
      summary: `${parsed.data.fullName} added without software access`,
    });
    revalidatePath(`/${tenantSlug}/hr`);
    revalidatePath(`/${tenantSlug}/hr/people`);
    return { ok: true, profileId: profile.id };
  } catch {
    return { ok: false, error: "Could not add this employee. Their email may already be linked to a record." };
  }
}

function payloadHasValues(payload: Record<string, string>) {
  return Object.values(payload).some((value) => value.trim().length > 0);
}

const PREFILL_FORM_LABELS: Record<HrFormType, string> = {
  BIODATA: "Biodata",
  BANK_FORM: "Bank account",
  GUARANTOR: "Guarantor",
  HEALTH: "Health",
};

export async function prefillEmployeeFromUploadedDocs(
  tenantSlug: string,
  userId: string,
): Promise<
  | {
      ok: true;
      applied: number;
      skipped: number;
      failed: Array<{ fileName: string; error: string }>;
      filled: string[];
    }
  | { ok: false; error: string }
> {
  const ctx = await hrContext(tenantSlug, { requireAi: true });
  if ("error" in ctx) return { ok: false, error: ctx.error || "You do not have permission." };

  const profile = await prisma.employeeProfile.findUnique({
    where: { tenantId_userId: { tenantId: ctx.tenant.id, userId } },
    select: { id: true, fullName: true, userId: true, workEmail: true },
  });
  if (!profile) return { ok: false, error: "Create this employee record first, then prefill from their documents." };

  const [documents, pendingRequests] = await Promise.all([
    prisma.hrDocument.findMany({
      where: { tenantId: ctx.tenant.id, employeeProfileId: profile.id, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, fileUrl: true, fileName: true, category: true, title: true },
    }),
    prisma.hrFormRequest.findMany({
      where: {
        tenantId: ctx.tenant.id,
        employeeProfileId: profile.id,
        status: HrFormRequestStatus.SUBMITTED,
      },
      select: { id: true, formType: true, submittedPayload: true, submittedFileUrl: true },
    }),
  ]);

  if (!documents.length && !pendingRequests.length) {
    return { ok: false, error: "No uploaded documents were found for this employee." };
  }

  const filled = new Set<string>();
  const failed: Array<{ fileName: string; error: string }> = [];
  let applied = 0;
  let skipped = 0;
  const appliedFileUrls = new Set<string>();

  for (const request of pendingRequests) {
    if (!request.submittedPayload) {
      skipped += 1;
      continue;
    }
    await prisma.employeeProfile.update({
      where: { id: profile.id },
      data: mergeHrFormIntoProfile(request.formType, request.submittedPayload),
    });
    await prisma.hrFormRequest.update({
      where: { id: request.id },
      data: {
        status: HrFormRequestStatus.APPROVED,
        approvedAt: new Date(),
        approvedByUserId: ctx.session.user.id,
      },
    });
    filled.add(PREFILL_FORM_LABELS[request.formType]);
    const submitted = request.submittedPayload;
    if (
      submitted &&
      typeof submitted === "object" &&
      (("taxId" in submitted && String((submitted as { taxId?: unknown }).taxId || "").trim()) ||
        ("rsaPin" in submitted && String((submitted as { rsaPin?: unknown }).rsaPin || "").trim()))
    ) {
      filled.add("Statutory IDs");
    }
    applied += 1;
    if (request.submittedFileUrl) appliedFileUrls.add(request.submittedFileUrl);
  }

  for (const document of documents) {
    if (appliedFileUrls.has(document.fileUrl)) {
      skipped += 1;
      continue;
    }
    const fileName = document.fileName?.trim() || document.title?.trim() || "";
    if (!fileName) {
      skipped += 1;
      continue;
    }
    const ext = fileName.toLowerCase().split(".").pop() || "";
    if (ext === "doc" || ext === "xls") {
      failed.push({
        fileName,
        error: "Save this file as PDF, DOCX, or XLSX and upload again.",
      });
      continue;
    }
    try {
      if (applied + failed.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      const extracted = await extractHrDocument({
        fileUrl: document.fileUrl,
        fileName,
        category: document.category === "OTHER" || document.category === "NDA" ? "AUTO" : document.category,
      });
      if (!extracted.formType || !payloadHasValues(extracted.payload)) {
        skipped += 1;
        continue;
      }
      await prisma.employeeProfile.update({
        where: { id: profile.id },
        data: mergeHrFormIntoProfile(extracted.formType, extracted.payload),
      });
      await prisma.hrFormRequest.create({
        data: {
          tenantId: ctx.tenant.id,
          employeeProfileId: profile.id,
          recipientName: profile.fullName || extracted.employeeName || "Employee",
          recipientEmail: profile.workEmail || extracted.employeeEmail || null,
          formType: extracted.formType,
          deliveryMode: HrFormDeliveryMode.PRINT_UPLOAD,
          status: HrFormRequestStatus.APPROVED,
          token: randomBytes(24).toString("base64url"),
          hrNote: `Prefill from uploaded docs · ${extracted.category} · ${fileName} · confidence ${Math.round(
            extracted.confidence * 100,
          )}%`,
          submittedPayload: extracted.payload,
          submittedFileUrl: document.fileUrl,
          submittedFileName: fileName,
          submittedAt: new Date(),
          approvedAt: new Date(),
          approvedByUserId: ctx.session.user.id,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          createdByUserId: ctx.session.user.id,
          createdByLabel: ctx.session.user.name || ctx.session.user.email || "HR",
        },
      });
      if (extracted.category !== document.category && document.category === "OTHER") {
        await prisma.hrDocument.update({
          where: { id: document.id },
          data: { category: extracted.category },
        });
      }
      filled.add(PREFILL_FORM_LABELS[extracted.formType]);
      if (extracted.payload.taxId || extracted.payload.rsaPin) filled.add("Statutory IDs");
      applied += 1;
    } catch (error) {
      failed.push({
        fileName,
        error: error instanceof Error ? error.message : "Could not read this file.",
      });
      if (error instanceof GeminiRateLimitError) {
        skipped += documents.length - documents.indexOf(document) - 1;
        break;
      }
    }
  }

  await ensureEmployeeNumber(profile.id);
  await writeAuditLog({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.session.user.id,
    actorLabel: ctx.session.user.name || ctx.session.user.email,
    module: "HR",
    entityType: "EmployeeProfile",
    entityId: profile.id,
    action: "PREFILL_FROM_DOCUMENTS",
    summary: `Prefill from uploaded docs for ${profile.fullName || "employee"}: ${applied} applied, ${skipped} skipped, ${failed.length} failed.`,
    metadata: { applied, skipped, failed: failed.length, filled: Array.from(filled) },
  });
  revalidatePath(`/${tenantSlug}/hr`);
  revalidatePath(`/${tenantSlug}/hr/people`);
  revalidatePath(`/${tenantSlug}/hr/documents`);

  return {
    ok: true,
    applied,
    skipped,
    failed,
    filled: Array.from(filled),
  };
}
