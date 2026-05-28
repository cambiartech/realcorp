"use server";

import { auth } from "@/auth";
import { randomBytes } from "crypto";
import {
  EmployeeProfileStatus,
  HrAppraisalCycleStatus,
  HrAppraisalCycleType,
  HrAppraisalStatus,
  HrDocumentCategory,
  HrFormDeliveryMode,
  HrFormRequestStatus,
  HrFormType,
  HrOfferLetterStatus,
  HrPayslipPaymentStatus,
  HrPayslipRunStatus,
  MembershipStatus,
  Prisma,
} from "@/generated/prisma";
import { absoluteAppUrl } from "@/lib/app-url";
import { mergeHrFormIntoProfile } from "@/lib/hr-form-merge";
import { hrFormFillPath, HR_FORM_TYPE_LABELS, hrOnboardingBundlePath, sortFormTypes } from "@/lib/hr-form-types";
import { hrOfferSignPath } from "@/lib/hr-offer-path";
import { sanitizeOfferLetterHtml } from "@/lib/offer-letter-html";
import { sanitizeRichTextHtml } from "@/lib/rich-text-sanitize";
import { DEFAULT_APPRAISAL_CRITERIA } from "@/lib/appraisal-competencies";
import {
  averageConfirmedRatings,
  mergeManagerAppraisalScores,
  mergeSelfAppraisalScores,
  parseActionScores,
  type AppraisalActionScores,
} from "@/lib/appraisal-scores";
import { writeAuditLog } from "@/lib/audit-log";
import {
  createTenantUploadSignature,
  type CloudinaryUploadError,
  type CloudinaryUploadSignature,
} from "@/lib/cloudinary-upload-server";
import prisma from "@/lib/db";
import { canManageHr } from "@/lib/hr-access";
import { ensureEmployeeNumber } from "@/lib/hr-employee-number";
import { calculateNigeriaPayslip } from "@/lib/hr-payslip";
import {
  addHrDocumentSchema,
  createAppraisalActionSchema,
  createAppraisalCycleSchema,
  createPayslipRunSchema,
  markPayslipPaymentsSchema,
  upsertEmployeeProfileSchema,
  updatePerformanceGoalSchema,
  upsertPerformanceGoalSchema,
} from "@/lib/validators/hr";
import { revalidatePath } from "next/cache";
import { z } from "zod";

type ActionResult = { ok: true } | { ok: false; error: string };
type PayslipActionResult = ActionResult & { count?: number };

async function getTenantAndMembership(tenantSlug: string, userId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, slug: true, defaultCurrency: true },
  });
  if (!tenant) return { tenant: null, membership: null };
  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId } },
    select: { status: true, role: true },
  });
  return { tenant, membership };
}

function revalidateHr(tenantSlug: string) {
  revalidatePath(`/${tenantSlug}/hr`);
  revalidatePath(`/${tenantSlug}/hr/people`);
  revalidatePath(`/${tenantSlug}/hr/payslips`);
  revalidatePath(`/${tenantSlug}/hr/appraisals`);
  revalidatePath(`/${tenantSlug}/hr/documents`);
  revalidatePath(`/${tenantSlug}/hr/dashboard`);
  revalidatePath(`/${tenantSlug}/hr/my`);
  revalidatePath(`/${tenantSlug}/hr/insights`);
}

export async function getHrUploadSignature(
  tenantSlug: string,
  input?: { fileName?: string },
): Promise<CloudinaryUploadSignature | CloudinaryUploadError> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to upload HR files." };
  }
  return createTenantUploadSignature({
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    area: "hr",
    fileName: input?.fileName,
  });
}

export async function upsertEmployeeProfile(
  tenantSlug: string,
  input: Record<string, unknown>,
): Promise<ActionResult & { profileId?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const parsed = upsertEmployeeProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to manage employee records." };
  }

  const member = await prisma.membership.findFirst({
    where: { tenantId: tenant.id, userId: parsed.data.userId, status: MembershipStatus.ACTIVE },
  });
  if (!member) return { ok: false, error: "User must be an active team member." };

  const existing = await prisma.employeeProfile.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: parsed.data.userId } },
  });

  const inputKeys = new Set(Object.keys(input));
  const has = (k: string) => inputKeys.has(k);

  const existingRow = existing ?? null;

  const strOrNull = (v: string | undefined) => (v && v !== "" ? v : null);
  const pickStr = (key: string, v: string | undefined) => {
    if (!has(key)) return existingRow ? undefined : strOrNull(v);
    if (existingRow && !v) return undefined;
    return strOrNull(v);
  };
  const pickDate = (key: string, v: string | undefined) => {
    if (!has(key)) return existingRow ? undefined : v ? new Date(v) : null;
    if (existingRow && !v) return undefined;
    return v ? new Date(v) : null;
  };
  const pickMoney = (key: string, v: number | undefined) => {
    if (!has(key)) return existingRow ? undefined : v ?? null;
    return v ?? null;
  };

  const data: Prisma.EmployeeProfileUpdateInput = {
    ...(has("employeeNumber") ? { employeeNumber: strOrNull(parsed.data.employeeNumber) } : {}),
    ...(has("status") ? { status: (parsed.data.status as EmployeeProfileStatus) || EmployeeProfileStatus.ACTIVE } : {}),
    ...(has("fullName") ? { fullName: parsed.data.fullName } : {}),
    ...(pickStr("gender", parsed.data.gender) !== undefined ? { gender: pickStr("gender", parsed.data.gender) } : {}),
    ...(pickDate("dateOfBirth", parsed.data.dateOfBirth) !== undefined
      ? { dateOfBirth: pickDate("dateOfBirth", parsed.data.dateOfBirth) }
      : {}),
    ...(pickStr("maritalStatus", parsed.data.maritalStatus) !== undefined
      ? { maritalStatus: pickStr("maritalStatus", parsed.data.maritalStatus) }
      : {}),
    ...(pickStr("nationality", parsed.data.nationality) !== undefined
      ? { nationality: pickStr("nationality", parsed.data.nationality) }
      : {}),
    ...(pickStr("phoneMobile", parsed.data.phoneMobile) !== undefined
      ? { phoneMobile: pickStr("phoneMobile", parsed.data.phoneMobile) }
      : {}),
    ...(pickStr("workEmail", parsed.data.workEmail) !== undefined
      ? { workEmail: pickStr("workEmail", parsed.data.workEmail) }
      : {}),
    ...(pickStr("addressStreet", parsed.data.addressStreet) !== undefined
      ? { addressStreet: pickStr("addressStreet", parsed.data.addressStreet) }
      : {}),
    ...(pickStr("addressCity", parsed.data.addressCity) !== undefined
      ? { addressCity: pickStr("addressCity", parsed.data.addressCity) }
      : {}),
    ...(pickStr("addressState", parsed.data.addressState) !== undefined
      ? { addressState: pickStr("addressState", parsed.data.addressState) }
      : {}),
    ...(pickStr("position", parsed.data.position) !== undefined ? { position: pickStr("position", parsed.data.position) } : {}),
    ...(pickStr("department", parsed.data.department) !== undefined
      ? { department: pickStr("department", parsed.data.department) }
      : {}),
    ...(pickDate("dateOfJoining", parsed.data.dateOfJoining) !== undefined
      ? { dateOfJoining: pickDate("dateOfJoining", parsed.data.dateOfJoining) }
      : {}),
    ...(pickStr("reportingToLabel", parsed.data.reportingToLabel) !== undefined
      ? { reportingToLabel: pickStr("reportingToLabel", parsed.data.reportingToLabel) }
      : {}),
    ...(pickStr("employmentType", parsed.data.employmentType) !== undefined
      ? { employmentType: pickStr("employmentType", parsed.data.employmentType) }
      : {}),
    ...(pickStr("workSchedule", parsed.data.workSchedule) !== undefined
      ? { workSchedule: pickStr("workSchedule", parsed.data.workSchedule) }
      : {}),
    ...(pickStr("paygroupName", parsed.data.paygroupName) !== undefined
      ? { paygroupName: pickStr("paygroupName", parsed.data.paygroupName) }
      : {}),
    ...(pickMoney("grossMonthly", parsed.data.grossMonthly) !== undefined
      ? { grossMonthly: pickMoney("grossMonthly", parsed.data.grossMonthly) }
      : {}),
    ...(pickMoney("payeeTaxMonthly", parsed.data.payeeTaxMonthly) !== undefined
      ? { payeeTaxMonthly: pickMoney("payeeTaxMonthly", parsed.data.payeeTaxMonthly) }
      : {}),
    ...(has("basicPercent") ? { basicPercent: parsed.data.basicPercent ?? 30 } : {}),
    ...(has("housingPercent") ? { housingPercent: parsed.data.housingPercent ?? 20 } : {}),
    ...(has("transportPercent") ? { transportPercent: parsed.data.transportPercent ?? 15 } : {}),
    ...(has("otherPercent") ? { otherPercent: parsed.data.otherPercent ?? 35 } : {}),
    ...(has("emergencyContactJson") ? { emergencyContact: parsed.data.emergencyContactJson as Prisma.InputJsonValue } : {}),
    ...(has("educationJson") ? { education: parsed.data.educationJson as Prisma.InputJsonValue } : {}),
    ...(has("nextOfKinJson") ? { nextOfKin: parsed.data.nextOfKinJson as Prisma.InputJsonValue } : {}),
    ...(has("healthInfoJson") ? { healthInfo: parsed.data.healthInfoJson as Prisma.InputJsonValue } : {}),
    ...(has("additionalInfoJson") ? { additionalInfo: parsed.data.additionalInfoJson as Prisma.InputJsonValue } : {}),
    ...(has("bankAccountJson") ? { bankAccount: parsed.data.bankAccountJson as Prisma.InputJsonValue } : {}),
    ...(has("guarantorInfoJson") ? { guarantorInfo: parsed.data.guarantorInfoJson as Prisma.InputJsonValue } : {}),
    ...(pickStr("hrNotes", parsed.data.hrNotes) !== undefined ? { hrNotes: pickStr("hrNotes", parsed.data.hrNotes) } : {}),
  };

  const createData = {
    employeeNumber: parsed.data.employeeNumber || null,
    status: (parsed.data.status as EmployeeProfileStatus) || EmployeeProfileStatus.ACTIVE,
    fullName: parsed.data.fullName,
    gender: parsed.data.gender || null,
    dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : null,
    maritalStatus: parsed.data.maritalStatus || null,
    nationality: parsed.data.nationality || null,
    phoneMobile: parsed.data.phoneMobile || null,
    workEmail: parsed.data.workEmail || null,
    addressStreet: parsed.data.addressStreet || null,
    addressCity: parsed.data.addressCity || null,
    addressState: parsed.data.addressState || null,
    position: parsed.data.position || null,
    department: parsed.data.department || null,
    dateOfJoining: parsed.data.dateOfJoining ? new Date(parsed.data.dateOfJoining) : null,
    reportingToLabel: parsed.data.reportingToLabel || null,
    employmentType: parsed.data.employmentType || null,
    workSchedule: parsed.data.workSchedule || null,
    paygroupName: parsed.data.paygroupName || null,
    grossMonthly: parsed.data.grossMonthly ?? null,
    payeeTaxMonthly: parsed.data.payeeTaxMonthly ?? null,
    basicPercent: parsed.data.basicPercent ?? 30,
    housingPercent: parsed.data.housingPercent ?? 20,
    transportPercent: parsed.data.transportPercent ?? 15,
    otherPercent: parsed.data.otherPercent ?? 35,
    emergencyContact: parsed.data.emergencyContactJson as Prisma.InputJsonValue | undefined,
    education: parsed.data.educationJson as Prisma.InputJsonValue | undefined,
    nextOfKin: parsed.data.nextOfKinJson as Prisma.InputJsonValue | undefined,
    healthInfo: parsed.data.healthInfoJson as Prisma.InputJsonValue | undefined,
    additionalInfo: parsed.data.additionalInfoJson as Prisma.InputJsonValue | undefined,
    bankAccount: parsed.data.bankAccountJson as Prisma.InputJsonValue | undefined,
    guarantorInfo: parsed.data.guarantorInfoJson as Prisma.InputJsonValue | undefined,
    hrNotes: parsed.data.hrNotes || null,
  };

  const profile = existing
    ? await prisma.employeeProfile.update({ where: { id: existing.id }, data })
    : await prisma.employeeProfile.create({
        data: { tenantId: tenant.id, userId: parsed.data.userId, ...createData },
      });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email || "HR",
    module: "HR",
    entityType: "EMPLOYEE_PROFILE",
    entityId: profile.id,
    action: existing ? "UPDATE" : "CREATE",
    summary: `${existing ? "Updated" : "Created"} employee record for ${parsed.data.fullName}.`,
  });

  revalidateHr(tenantSlug);
  await ensureEmployeeNumber(profile.id);
  return { ok: true, profileId: profile.id };
}

export async function createAppraisalActionItem(
  tenantSlug: string,
  input: { title: string; description?: string; cycleType: "MONTHLY" | "YEARLY"; sortOrder?: number },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const parsed = createAppraisalActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }

  await prisma.hrAppraisalAction.create({
    data: {
      tenantId: tenant.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      cycleType: parsed.data.cycleType as HrAppraisalCycleType,
      sortOrder: parsed.data.sortOrder ?? 0,
    },
  });
  revalidateHr(tenantSlug);
  return { ok: true };
}

/** Seed standard competency criteria (monthly + yearly) when a tenant has none yet. */
export async function ensureDefaultAppraisalCriteria(tenantId: string): Promise<void> {
  const count = await prisma.hrAppraisalAction.count({ where: { tenantId } });
  if (count > 0) return;

  await prisma.hrAppraisalAction.createMany({
    data: DEFAULT_APPRAISAL_CRITERIA.map((c) => ({
      tenantId,
      title: c.title,
      description: c.description,
      cycleType: c.cycleType as HrAppraisalCycleType,
      sortOrder: c.sortOrder,
      isActive: true,
    })),
  });
}

export async function createAppraisalCycle(
  tenantSlug: string,
  input: { cycleType: "MONTHLY" | "YEARLY"; periodLabel: string; dueDate?: string },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const parsed = createAppraisalCycleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }

  const cycle = await prisma.hrAppraisalCycle.create({
    data: {
      tenantId: tenant.id,
      cycleType: parsed.data.cycleType as HrAppraisalCycleType,
      periodLabel: parsed.data.periodLabel,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    },
  });

  const profiles = await prisma.employeeProfile.findMany({
    where: { tenantId: tenant.id, status: EmployeeProfileStatus.ACTIVE },
    select: { id: true },
  });
  if (profiles.length) {
    await prisma.hrAppraisal.createMany({
      data: profiles.map((p) => ({
        tenantId: tenant.id,
        cycleId: cycle.id,
        employeeProfileId: p.id,
        status: HrAppraisalStatus.DRAFT,
      })),
      skipDuplicates: true,
    });
  }

  revalidateHr(tenantSlug);
  return { ok: true };
}

export async function closeAppraisalCycle(tenantSlug: string, cycleId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }

  await prisma.hrAppraisalCycle.update({
    where: { id: cycleId, tenantId: tenant.id },
    data: { status: HrAppraisalCycleStatus.CLOSED },
  });
  revalidateHr(tenantSlug);
  return { ok: true };
}

export async function saveAppraisalReview(
  tenantSlug: string,
  appraisalId: string,
  input: {
    managerNotes?: string;
    overallRating?: number;
    actionScoresJson?: string;
    actionResponses?: Array<{
      actionId: string;
      managerRating?: number;
      managerNotes?: string;
      rating?: number;
      completed?: boolean;
    }>;
  },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }

  const existing = await prisma.hrAppraisal.findFirst({
    where: { id: appraisalId, tenantId: tenant.id },
    select: { actionScores: true },
  });
  const prior = parseActionScores(existing?.actionScores);

  let actionScores: AppraisalActionScores | undefined;
  let overallRating = input.overallRating;

  if (input.actionResponses?.length) {
    actionScores = mergeManagerAppraisalScores(
      prior,
      input.actionResponses.map((row) => ({
        actionId: row.actionId,
        managerRating: row.managerRating ?? row.rating,
        managerNotes: row.managerNotes,
      })),
    );
    const actionIds = input.actionResponses.map((r) => r.actionId);
    const computed = averageConfirmedRatings(actionScores, actionIds);
    if (computed != null && overallRating == null) {
      overallRating = Math.round(computed);
    }
  } else if (input.actionScoresJson?.trim()) {
    try {
      actionScores = parseActionScores(JSON.parse(input.actionScoresJson));
    } catch {
      return { ok: false, error: "Invalid scores format." };
    }
  }

  await prisma.hrAppraisal.update({
    where: { id: appraisalId, tenantId: tenant.id },
    data: {
      managerNotes: input.managerNotes ? sanitizeRichTextHtml(input.managerNotes) : null,
      overallRating: overallRating ?? null,
      actionScores: actionScores as Prisma.InputJsonValue | undefined,
      status: HrAppraisalStatus.REVIEWED,
      reviewerUserId: session.user.id,
      reviewerLabel: session.user.name || session.user.email || "Reviewer",
      reviewedAt: new Date(),
    },
  });
  revalidateHr(tenantSlug);
  return { ok: true };
}

export async function saveSelfAppraisal(
  tenantSlug: string,
  appraisalId: string,
  input: {
    selfNotes?: string;
    actionResponses?: Array<{
      actionId: string;
      selfRating?: number;
      selfNotes?: string;
      rating?: number;
      completed?: boolean;
    }>;
  },
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };

  const appraisal = await prisma.hrAppraisal.findFirst({
    where: { id: appraisalId, tenantId: tenant.id },
    include: { profile: { select: { userId: true } }, cycle: { select: { status: true } } },
  });
  if (!appraisal) return { ok: false, error: "Appraisal not found." };
  if (appraisal.profile.userId !== session.user.id && !canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You can only update your own appraisal." };
  }
  if (appraisal.cycle.status !== HrAppraisalCycleStatus.OPEN) {
    return { ok: false, error: "This appraisal period is closed." };
  }

  const prior = parseActionScores(appraisal.actionScores);
  let actionScores: AppraisalActionScores | undefined;

  if (input.actionResponses?.length) {
    actionScores = mergeSelfAppraisalScores(
      prior,
      input.actionResponses.map((row) => ({
        actionId: row.actionId,
        selfRating: row.selfRating ?? row.rating,
        selfNotes: row.selfNotes ? sanitizeRichTextHtml(row.selfNotes) : undefined,
      })),
    );
  }

  await prisma.hrAppraisal.update({
    where: { id: appraisalId },
    data: {
      selfNotes: input.selfNotes ? sanitizeRichTextHtml(input.selfNotes) : null,
      actionScores: actionScores as Prisma.InputJsonValue | undefined,
      status: HrAppraisalStatus.SELF_SUBMITTED,
    },
  });
  revalidateHr(tenantSlug);
  return { ok: true };
}

function paygroupProfileFilter(paygroupName?: string) {
  if (!paygroupName || paygroupName === "ALL") return {};
  if (paygroupName === "__UNASSIGNED__") {
    return { OR: [{ paygroupName: null }, { paygroupName: "" }] };
  }
  return { paygroupName };
}

export async function generatePayslipRun(
  tenantSlug: string,
  input: { year: number; month: number; paygroupName?: string },
): Promise<PayslipActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const parsed = createPayslipRunSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }

  const label = new Intl.DateTimeFormat("en-NG", { month: "long", year: "numeric" }).format(
    new Date(parsed.data.year, parsed.data.month - 1, 1),
  );

  const run = await prisma.hrPayslipRun.upsert({
    where: {
      tenantId_year_month: {
        tenantId: tenant.id,
        year: parsed.data.year,
        month: parsed.data.month,
      },
    },
    create: {
      tenantId: tenant.id,
      year: parsed.data.year,
      month: parsed.data.month,
      label,
      status: HrPayslipRunStatus.DRAFT,
    },
    update: { label },
  });

  const profiles = await prisma.employeeProfile.findMany({
    where: {
      tenantId: tenant.id,
      status: EmployeeProfileStatus.ACTIVE,
      grossMonthly: { not: null },
      ...paygroupProfileFilter(parsed.data.paygroupName),
    },
  });

  let generatedCount = 0;
  for (const profile of profiles) {
    const gross = Number(profile.grossMonthly);
    if (!gross || gross <= 0) continue;
    generatedCount += 1;
    const payeeOverride =
      profile.payeeTaxMonthly != null && Number(profile.payeeTaxMonthly) >= 0
        ? Number(profile.payeeTaxMonthly)
        : undefined;
    const calc = calculateNigeriaPayslip({
      grossMonthly: gross,
      basicPercent: Number(profile.basicPercent),
      housingPercent: Number(profile.housingPercent),
      transportPercent: Number(profile.transportPercent),
      otherPercent: Number(profile.otherPercent),
      payeeTax: payeeOverride,
    });
    await prisma.hrPayslip.upsert({
      where: { runId_employeeProfileId: { runId: run.id, employeeProfileId: profile.id } },
      create: {
        tenantId: tenant.id,
        runId: run.id,
        employeeProfileId: profile.id,
        currency: tenant.defaultCurrency,
        grossPay: calc.grossPay,
        payeeTax: calc.payeeTax,
        pensionDeduction: calc.pensionDeduction,
        otherDeductions: calc.otherDeductions,
        netPay: calc.netPay,
        earningsBreakdown: calc.earnings as Prisma.InputJsonValue,
        deductionsBreakdown: calc.deductions as Prisma.InputJsonValue,
      },
      update: {
        grossPay: calc.grossPay,
        payeeTax: calc.payeeTax,
        pensionDeduction: calc.pensionDeduction,
        otherDeductions: calc.otherDeductions,
        netPay: calc.netPay,
        earningsBreakdown: calc.earnings as Prisma.InputJsonValue,
        deductionsBreakdown: calc.deductions as Prisma.InputJsonValue,
      },
    });
  }

  revalidateHr(tenantSlug);
  return { ok: true, count: generatedCount };
}

export async function finalizePayslipRun(tenantSlug: string, runId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }

  const run = await prisma.hrPayslipRun.findFirst({
    where: { id: runId, tenantId: tenant.id },
    include: { _count: { select: { payslips: true } } },
  });
  if (!run) return { ok: false, error: "Payroll run not found." };
  if (run._count.payslips === 0) {
    return {
      ok: false,
      error: "No payslips in this run. Generate payslips first (employees need gross pay on People → Job).",
    };
  }

  await prisma.hrPayslipRun.update({
    where: { id: runId },
    data: { status: HrPayslipRunStatus.FINALIZED },
  });
  revalidateHr(tenantSlug);
  return { ok: true };
}

export async function markPayslipPayments(
  tenantSlug: string,
  input: Record<string, unknown>,
): Promise<PayslipActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const parsed = markPayslipPaymentsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }

  const slips = await prisma.hrPayslip.findMany({
    where: { id: { in: parsed.data.payslipIds }, tenantId: tenant.id },
    include: { run: { select: { status: true } } },
  });
  if (slips.length === 0) return { ok: false, error: "No matching payslips." };

  const notPublished = slips.filter((s) => s.run.status !== HrPayslipRunStatus.FINALIZED);
  if (notPublished.length > 0) {
    return { ok: false, error: "Publish the payroll month before recording bank payments." };
  }

  const paid = parsed.data.paymentStatus === "PAID";
  const label = session.user.name || session.user.email || "HR";

  await prisma.hrPayslip.updateMany({
    where: { id: { in: slips.map((s) => s.id) }, tenantId: tenant.id },
    data: {
      paymentStatus: paid ? HrPayslipPaymentStatus.PAID : HrPayslipPaymentStatus.PENDING,
      paidAt: paid ? new Date() : null,
      paymentReference: paid ? parsed.data.paymentReference || null : null,
      paidByLabel: paid ? label : null,
    },
  });

  revalidateHr(tenantSlug);
  return { ok: true, count: slips.length };
}

export async function finalizeAllDraftPayslipRuns(tenantSlug: string): Promise<ActionResult & { count?: number }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }

  const draftsWithSlips = await prisma.hrPayslipRun.findMany({
    where: { tenantId: tenant.id, status: HrPayslipRunStatus.DRAFT },
    include: { _count: { select: { payslips: true } } },
  });
  const publishable = draftsWithSlips.filter((r) => r._count.payslips > 0);
  if (publishable.length === 0) {
    return { ok: false, error: "No draft runs with payslips to publish. Generate payslips first." };
  }

  const result = await prisma.hrPayslipRun.updateMany({
    where: { id: { in: publishable.map((r) => r.id) } },
    data: { status: HrPayslipRunStatus.FINALIZED },
  });

  revalidateHr(tenantSlug);
  return { ok: true, count: result.count };
}

async function resolveEmployeeProfileId(tenantId: string, input: { employeeProfileId?: string; userId?: string }) {
  if (input.employeeProfileId) {
    const existing = await prisma.employeeProfile.findFirst({
      where: { id: input.employeeProfileId, tenantId },
      select: { id: true },
    });
    if (existing) return existing.id;
  }
  if (!input.userId) return null;

  const member = await prisma.membership.findFirst({
    where: { tenantId, userId: input.userId, status: MembershipStatus.ACTIVE },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!member) return null;

  const profile = await prisma.employeeProfile.upsert({
    where: { tenantId_userId: { tenantId, userId: input.userId } },
    create: {
      tenantId,
      userId: input.userId,
      fullName: member.user.name || member.user.email || "Team member",
      status: EmployeeProfileStatus.DRAFT,
    },
    update: {},
    select: { id: true },
  });
  return profile.id;
}

export async function addHrDocument(tenantSlug: string, input: Record<string, unknown>): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const parsed = addHrDocumentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }

  const employeeProfileId = await resolveEmployeeProfileId(tenant.id, {
    employeeProfileId: parsed.data.employeeProfileId,
    userId: parsed.data.userId,
  });
  if (!employeeProfileId) {
    return { ok: false, error: "Employee not found. Pick someone from your active Team list." };
  }

  await prisma.hrDocument.create({
    data: {
      tenantId: tenant.id,
      employeeProfileId,
      category: parsed.data.category as HrDocumentCategory,
      title: parsed.data.title,
      fileUrl: parsed.data.fileUrl,
      fileName: parsed.data.fileName || null,
      uploadedByUserId: session.user.id,
      uploadedByLabel: session.user.name || session.user.email || "HR",
    },
  });
  revalidateHr(tenantSlug);
  return { ok: true };
}

export async function upsertPerformanceGoal(
  tenantSlug: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const parsed = upsertPerformanceGoalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }

  await prisma.hrPerformanceGoal.create({
    data: {
      tenantId: tenant.id,
      employeeProfileId: parsed.data.employeeProfileId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      targetValue: parsed.data.targetValue || null,
      progressPercent: parsed.data.progressPercent ?? 0,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      createdByLabel: session.user.name || session.user.email || "HR",
    },
  });
  revalidateHr(tenantSlug);
  return { ok: true };
}

export async function updatePerformanceGoal(
  tenantSlug: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const parsed = updatePerformanceGoalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }

  const existing = await prisma.hrPerformanceGoal.findFirst({
    where: { id: parsed.data.id, tenantId: tenant.id },
  });
  if (!existing) return { ok: false, error: "Goal not found." };

  await prisma.hrPerformanceGoal.update({
    where: { id: parsed.data.id },
    data: {
      ...(parsed.data.progressPercent !== undefined ? { progressPercent: parsed.data.progressPercent } : {}),
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
    },
  });
  revalidateHr(tenantSlug);
  return { ok: true };
}

export async function createHrFormRequest(
  tenantSlug: string,
  input: {
    employeeProfileId?: string;
    userId?: string;
    recipientName?: string;
    recipientEmail?: string;
    formType: HrFormType;
    deliveryMode: HrFormDeliveryMode;
    expiresInDays?: number;
    hrNote?: string;
    bundleToken?: string | null;
  },
): Promise<ActionResult & { fillUrl?: string; printUrl?: string; requestId?: string; sendToEmail?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }

  let profileId: string | null = input.employeeProfileId ?? null;
  let sendToEmail: string | undefined;

  if (input.userId) {
    const member = await prisma.membership.findFirst({
      where: { tenantId: tenant.id, userId: input.userId, status: MembershipStatus.ACTIVE },
      include: { user: { select: { name: true, email: true } } },
    });
    if (!member) return { ok: false, error: "That person is not on your Team list. Add them under Team first." };

    sendToEmail = member.user.email ?? undefined;
    const existing = await prisma.employeeProfile.findUnique({
      where: { tenantId_userId: { tenantId: tenant.id, userId: input.userId } },
    });
    const profile =
      existing ??
      (await prisma.employeeProfile.create({
        data: {
          tenantId: tenant.id,
          userId: input.userId,
          fullName: member.user.name || member.user.email || "Team member",
          workEmail: member.user.email,
          status: EmployeeProfileStatus.DRAFT,
        },
      }));
    profileId = profile.id;
    if (!existing) await ensureEmployeeNumber(profile.id);
  } else if (profileId) {
    const profile = await prisma.employeeProfile.findFirst({
      where: { id: profileId, tenantId: tenant.id },
      select: { id: true, workEmail: true },
    });
    if (!profile) return { ok: false, error: "Employee record not found." };
    sendToEmail = profile.workEmail ?? undefined;
  } else {
    const name = input.recipientName?.trim();
    const email = input.recipientEmail?.trim();
    if (!name || !email) {
      return { ok: false, error: "Select a team member or enter new joiner name and email." };
    }
    const emailCheck = z.string().email().safeParse(email);
    if (!emailCheck.success) return { ok: false, error: "Enter a valid email for the new joiner." };
    profileId = null;
    sendToEmail = email;
  }

  const days = Math.min(90, Math.max(1, input.expiresInDays ?? 14));
  const token = randomBytes(24).toString("base64url");

  const req = await prisma.hrFormRequest.create({
    data: {
      tenantId: tenant.id,
      employeeProfileId: profileId,
      recipientName: profileId ? null : input.recipientName?.trim() || null,
      recipientEmail: profileId ? null : input.recipientEmail?.trim() || null,
      formType: input.formType,
      deliveryMode: input.deliveryMode,
      token,
      bundleToken: input.bundleToken ?? null,
      hrNote: input.hrNote?.trim() || null,
      expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      createdByUserId: session.user.id,
      createdByLabel: session.user.name || session.user.email || "HR",
    },
  });

  revalidateHr(tenantSlug);
  return {
    ok: true,
    requestId: req.id,
    fillUrl: absoluteAppUrl(hrFormFillPath(token)),
    printUrl: absoluteAppUrl(`/hr-form/${token}/print`),
    sendToEmail,
  };
}

export type HrFormLinkResult = {
  formType: HrFormType;
  formTypeLabel: string;
  fillUrl: string;
  printUrl: string;
  requestId: string;
};

export async function createHrFormRequestsBatch(
  tenantSlug: string,
  input: {
    employeeProfileId?: string;
    userId?: string;
    recipientName?: string;
    recipientEmail?: string;
    formTypes: HrFormType[];
    deliveryMode: HrFormDeliveryMode;
    expiresInDays?: number;
    hrNote?: string;
  },
): Promise<
  ActionResult & {
    links?: HrFormLinkResult[];
    sendToEmail?: string;
    masterUrl?: string;
    masterPrintUrls?: { formTypeLabel: string; printUrl: string }[];
  }
> {
  const types = sortFormTypes([...new Set(input.formTypes)].filter(Boolean));
  if (types.length === 0) {
    return { ok: false, error: "Select at least one form to send." };
  }

  const bundleToken = types.length > 1 ? randomBytes(24).toString("base64url") : null;
  const links: HrFormLinkResult[] = [];
  let sendToEmail: string | undefined;
  let lastError: string | undefined;

  for (const formType of types) {
    const result = await createHrFormRequest(tenantSlug, {
      employeeProfileId: input.employeeProfileId,
      userId: input.userId,
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail,
      formType,
      deliveryMode: input.deliveryMode,
      expiresInDays: input.expiresInDays,
      hrNote: input.hrNote,
      bundleToken,
    });
    if (!result.ok) {
      lastError = result.error;
      continue;
    }
    if (result.sendToEmail) sendToEmail = result.sendToEmail;
    if (result.fillUrl && result.printUrl && result.requestId) {
      links.push({
        formType,
        formTypeLabel: HR_FORM_TYPE_LABELS[formType],
        fillUrl: result.fillUrl,
        printUrl: result.printUrl,
        requestId: result.requestId,
      });
    }
  }

  if (links.length === 0) {
    return { ok: false, error: lastError || "Could not create form links." };
  }

  const masterUrl = bundleToken
    ? absoluteAppUrl(hrOnboardingBundlePath(bundleToken, { tenant: tenantSlug }))
    : links[0]!.fillUrl;

  return {
    ok: true,
    links,
    sendToEmail,
    masterUrl,
    masterPrintUrls: links.map((l) => ({ formTypeLabel: l.formTypeLabel, printUrl: l.printUrl })),
  };
}

export async function approveHrFormRequest(tenantSlug: string, requestId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }

  const req = await prisma.hrFormRequest.findFirst({
    where: { id: requestId, tenantId: tenant.id },
  });
  if (!req) return { ok: false, error: "Form request not found." };
  if (req.status !== HrFormRequestStatus.SUBMITTED) {
    return { ok: false, error: "Only submitted forms can be approved." };
  }

  if (req.submittedPayload && req.employeeProfileId) {
    await prisma.employeeProfile.update({
      where: { id: req.employeeProfileId },
      data: mergeHrFormIntoProfile(req.formType, req.submittedPayload),
    });
    await ensureEmployeeNumber(req.employeeProfileId);
  }

  await prisma.hrFormRequest.update({
    where: { id: req.id },
    data: {
      status: HrFormRequestStatus.APPROVED,
      approvedAt: new Date(),
      approvedByUserId: session.user.id,
      approvedByLabel: session.user.name || session.user.email || "HR",
    },
  });

  revalidateHr(tenantSlug);
  return { ok: true };
}

export async function cancelHrFormRequest(tenantSlug: string, requestId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }

  await prisma.hrFormRequest.updateMany({
    where: {
      id: requestId,
      tenantId: tenant.id,
      status: { in: [HrFormRequestStatus.PENDING, HrFormRequestStatus.SUBMITTED] },
    },
    data: { status: HrFormRequestStatus.CANCELLED },
  });

  revalidateHr(tenantSlug);
  return { ok: true };
}

async function resolveOfferProfileId(
  tenantId: string,
  input: { employeeProfileId?: string; userId?: string },
): Promise<string | null> {
  if (input.employeeProfileId) {
    const row = await prisma.employeeProfile.findFirst({
      where: { id: input.employeeProfileId, tenantId },
      select: { id: true },
    });
    return row?.id ?? null;
  }
  if (!input.userId) return null;
  const member = await prisma.membership.findFirst({
    where: { tenantId, userId: input.userId, status: MembershipStatus.ACTIVE },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!member) return null;
  const existing = await prisma.employeeProfile.findUnique({
    where: { tenantId_userId: { tenantId, userId: input.userId } },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.employeeProfile.create({
    data: {
      tenantId,
      userId: input.userId,
      fullName: member.user.name || member.user.email || "Team member",
      workEmail: member.user.email,
      status: EmployeeProfileStatus.DRAFT,
    },
    select: { id: true },
  });
  return created.id;
}

export async function saveOfferLetterDraft(
  tenantSlug: string,
  input: { employeeProfileId?: string; userId?: string; bodyHtml: string },
): Promise<ActionResult & { profileId?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }

  const profileId = await resolveOfferProfileId(tenant.id, input);
  if (!profileId) return { ok: false, error: "Employee record not found." };

  const bodyHtml = sanitizeOfferLetterHtml(input.bodyHtml);
  if (!bodyHtml) return { ok: false, error: "Offer letter is empty." };

  await prisma.hrOfferLetter.upsert({
    where: { employeeProfileId: profileId },
    create: {
      tenantId: tenant.id,
      employeeProfileId: profileId,
      bodyHtml,
      status: HrOfferLetterStatus.DRAFT,
      lastEditedByUserId: session.user.id,
      lastEditedByLabel: session.user.name || session.user.email || "HR",
    },
    update: {
      bodyHtml,
      lastEditedByUserId: session.user.id,
      lastEditedByLabel: session.user.name || session.user.email || "HR",
    },
  });

  revalidateHr(tenantSlug);
  return { ok: true, profileId };
}

export async function sendOfferLetterForSignature(
  tenantSlug: string,
  employeeProfileId: string,
): Promise<ActionResult & { signUrl?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }

  const offer = await prisma.hrOfferLetter.findFirst({
    where: { tenantId: tenant.id, employeeProfileId },
  });
  if (!offer) return { ok: false, error: "Save the offer letter draft first." };
  if (offer.status === HrOfferLetterStatus.SIGNED) {
    return { ok: false, error: "This offer is already signed." };
  }

  const token = offer.token ?? randomBytes(24).toString("base64url");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.hrOfferLetter.update({
    where: { id: offer.id },
    data: {
      token,
      tokenExpiresAt: expires,
      status: HrOfferLetterStatus.AWAITING_SIGNATURE,
    },
  });

  revalidateHr(tenantSlug);
  return { ok: true, signUrl: absoluteAppUrl(hrOfferSignPath(token)) };
}
