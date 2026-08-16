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
  HrPayrollAdjustmentType,
  HrPayslipPaymentStatus,
  HrPayslipRunStatus,
  MembershipStatus,
  Prisma,
} from "@/generated/prisma";
import { absoluteAppUrl } from "@/lib/app-url";
import { mergeHrFormIntoProfile } from "@/lib/hr-form-merge";
import {
  hrFormFillPath,
  HR_FORM_TYPE_LABELS,
  hrOnboardingBundlePath,
  sortFormTypes,
} from "@/lib/hr-form-types";
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
import { calculatePayroll, PayrollConfigurationError } from "@/lib/payroll/engine";
import {
  addHrDocumentSchema,
  applyPayTemplateSchema,
  createAppraisalActionSchema,
  createAppraisalCycleSchema,
  createPayTemplateSchema,
  createPayslipRunSchema,
  markPayslipPaymentsSchema,
  savePayrollAdjustmentSchema,
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
    select: {
      id: true,
      slug: true,
      defaultCurrency: true,
      settings: { select: { payrollCountryCode: true, payrollSettings: true } },
    },
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
  input?: { fileName?: string; resourceType?: "auto" | "raw" | "image" },
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
    resourceType: input?.resourceType,
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

  const existing = await prisma.employeeProfile.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: parsed.data.userId } },
  });
  const member = await prisma.membership.findFirst({
    where: { tenantId: tenant.id, userId: parsed.data.userId, status: MembershipStatus.ACTIVE },
  });
  if (!member && !existing) {
    return { ok: false, error: "Choose an active team member or an existing HR/payroll-only record." };
  }

  const inputKeys = new Set(Object.keys(input));
  const has = (k: string) => inputKeys.has(k);

  const existingRow = existing ?? null;
  const selectedPayTemplate = parsed.data.payTemplateId
    ? await prisma.hrPayTemplate.findFirst({
        where: { id: parsed.data.payTemplateId, tenantId: tenant.id },
        select: { id: true },
      })
    : null;
  if (parsed.data.payTemplateId && !selectedPayTemplate) {
    return { ok: false, error: "The selected pay template is not available in this organization." };
  }
  const resultingTaxOverride = has("payeeTaxMonthly")
    ? parsed.data.payeeTaxMonthly
    : existingRow?.payeeTaxMonthly != null
      ? Number(existingRow.payeeTaxMonthly)
      : undefined;
  const resultingOverrideReason = has("taxOverrideReason")
    ? parsed.data.taxOverrideReason
    : existingRow?.taxOverrideReason || undefined;
  if (resultingTaxOverride !== undefined && !resultingOverrideReason?.trim()) {
    return { ok: false, error: "Add a reason for the manual PAYE tax override, or leave the override blank." };
  }

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
    if (!has(key)) return existingRow ? undefined : (v ?? null);
    return v ?? null;
  };

  const data: Prisma.EmployeeProfileUpdateInput = {
    ...(has("employeeNumber") ? { employeeNumber: strOrNull(parsed.data.employeeNumber) } : {}),
    ...(has("status")
      ? { status: (parsed.data.status as EmployeeProfileStatus) || EmployeeProfileStatus.ACTIVE }
      : {}),
    ...(has("fullName") ? { fullName: parsed.data.fullName } : {}),
    ...(pickStr("gender", parsed.data.gender) !== undefined
      ? { gender: pickStr("gender", parsed.data.gender) }
      : {}),
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
    ...(pickStr("addressCountry", parsed.data.addressCountry) !== undefined
      ? { addressCountry: pickStr("addressCountry", parsed.data.addressCountry) }
      : {}),
    ...(pickStr("position", parsed.data.position) !== undefined
      ? { position: pickStr("position", parsed.data.position) }
      : {}),
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
    ...(has("payTemplateId")
      ? { payTemplate: selectedPayTemplate ? { connect: { id: selectedPayTemplate.id } } : { disconnect: true } }
      : {}),
    ...(pickMoney("grossMonthly", parsed.data.grossMonthly) !== undefined
      ? { grossMonthly: pickMoney("grossMonthly", parsed.data.grossMonthly) }
      : {}),
    ...(pickMoney("payeeTaxMonthly", parsed.data.payeeTaxMonthly) !== undefined
      ? { payeeTaxMonthly: pickMoney("payeeTaxMonthly", parsed.data.payeeTaxMonthly) }
      : {}),
    ...(has("payrollCountryCode") ? { payrollCountryCode: parsed.data.payrollCountryCode || "NG" } : {}),
    ...(has("payrollRegionCode") ? { payrollRegionCode: strOrNull(parsed.data.payrollRegionCode) } : {}),
    ...(has("taxId") ? { taxId: strOrNull(parsed.data.taxId) } : {}),
    ...(has("taxOverrideReason") ? { taxOverrideReason: strOrNull(parsed.data.taxOverrideReason) } : {}),
    ...(has("rsaPin") ? { rsaPin: strOrNull(parsed.data.rsaPin) } : {}),
    ...(has("pensionAdministrator") ? { pensionAdministrator: strOrNull(parsed.data.pensionAdministrator) } : {}),
    ...(has("nhfMembershipNumber") ? { nhfMembershipNumber: strOrNull(parsed.data.nhfMembershipNumber) } : {}),
    ...(has("pensionEnabled") ? { pensionEnabled: parsed.data.pensionEnabled ?? true } : {}),
    ...(has("employeePensionRate") ? { employeePensionRate: parsed.data.employeePensionRate ?? 8 } : {}),
    ...(has("employerPensionRate") ? { employerPensionRate: parsed.data.employerPensionRate ?? 10 } : {}),
    ...(has("nhfMonthly") ? { nhfMonthly: parsed.data.nhfMonthly ?? 0 } : {}),
    ...(has("nhiaMonthly") ? { nhiaMonthly: parsed.data.nhiaMonthly ?? 0 } : {}),
    ...(has("annualRent") ? { annualRent: parsed.data.annualRent ?? 0 } : {}),
    ...(has("annualLifeInsurance") ? { annualLifeInsurance: parsed.data.annualLifeInsurance ?? 0 } : {}),
    ...(has("annualMortgageInterest")
      ? { annualMortgageInterest: parsed.data.annualMortgageInterest ?? 0 }
      : {}),
    ...(has("otherPreTaxMonthly") ? { otherPreTaxMonthly: parsed.data.otherPreTaxMonthly ?? 0 } : {}),
    ...(has("otherPostTaxMonthly") ? { otherPostTaxMonthly: parsed.data.otherPostTaxMonthly ?? 0 } : {}),
    ...(has("basicPercent") ? { basicPercent: parsed.data.basicPercent ?? 30 } : {}),
    ...(has("housingPercent") ? { housingPercent: parsed.data.housingPercent ?? 20 } : {}),
    ...(has("transportPercent") ? { transportPercent: parsed.data.transportPercent ?? 15 } : {}),
    ...(has("otherPercent") ? { otherPercent: parsed.data.otherPercent ?? 35 } : {}),
    ...(has("emergencyContactJson")
      ? { emergencyContact: parsed.data.emergencyContactJson as Prisma.InputJsonValue }
      : {}),
    ...(has("educationJson") ? { education: parsed.data.educationJson as Prisma.InputJsonValue } : {}),
    ...(has("nextOfKinJson") ? { nextOfKin: parsed.data.nextOfKinJson as Prisma.InputJsonValue } : {}),
    ...(has("healthInfoJson") ? { healthInfo: parsed.data.healthInfoJson as Prisma.InputJsonValue } : {}),
    ...(has("additionalInfoJson")
      ? { additionalInfo: parsed.data.additionalInfoJson as Prisma.InputJsonValue }
      : {}),
    ...(has("bankAccountJson") ? { bankAccount: parsed.data.bankAccountJson as Prisma.InputJsonValue } : {}),
    ...(has("guarantorInfoJson")
      ? { guarantorInfo: parsed.data.guarantorInfoJson as Prisma.InputJsonValue }
      : {}),
    ...(pickStr("hrNotes", parsed.data.hrNotes) !== undefined
      ? { hrNotes: pickStr("hrNotes", parsed.data.hrNotes) }
      : {}),
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
    addressCountry: parsed.data.addressCountry || null,
    position: parsed.data.position || null,
    department: parsed.data.department || null,
    dateOfJoining: parsed.data.dateOfJoining ? new Date(parsed.data.dateOfJoining) : null,
    reportingToLabel: parsed.data.reportingToLabel || null,
    employmentType: parsed.data.employmentType || null,
    workSchedule: parsed.data.workSchedule || null,
    paygroupName: parsed.data.paygroupName || null,
    payTemplateId: selectedPayTemplate?.id ?? null,
    grossMonthly: parsed.data.grossMonthly ?? null,
    payeeTaxMonthly: parsed.data.payeeTaxMonthly ?? null,
    payrollCountryCode: parsed.data.payrollCountryCode || tenant.settings?.payrollCountryCode || "NG",
    payrollRegionCode: parsed.data.payrollRegionCode || null,
    taxId: parsed.data.taxId || null,
    taxOverrideReason: parsed.data.taxOverrideReason || null,
    rsaPin: parsed.data.rsaPin || null,
    pensionAdministrator: parsed.data.pensionAdministrator || null,
    nhfMembershipNumber: parsed.data.nhfMembershipNumber || null,
    pensionEnabled: parsed.data.pensionEnabled ?? true,
    employeePensionRate: parsed.data.employeePensionRate ?? 8,
    employerPensionRate: parsed.data.employerPensionRate ?? 10,
    nhfMonthly: parsed.data.nhfMonthly ?? 0,
    nhiaMonthly: parsed.data.nhiaMonthly ?? 0,
    annualRent: parsed.data.annualRent ?? 0,
    annualLifeInsurance: parsed.data.annualLifeInsurance ?? 0,
    annualMortgageInterest: parsed.data.annualMortgageInterest ?? 0,
    otherPreTaxMonthly: parsed.data.otherPreTaxMonthly ?? 0,
    otherPostTaxMonthly: parsed.data.otherPostTaxMonthly ?? 0,
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
    metadata: { changedFields: Array.from(inputKeys).sort() },
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
  if (
    appraisal.profile.userId !== session.user.id &&
    !canManageHr(Boolean(session.user.isPlatformAdmin), membership)
  ) {
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

function employerContributionsFromSettings(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const rows = (value as Record<string, unknown>).employerContributions;
  if (!Array.isArray(rows)) return undefined;
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return [];
    const item = row as Record<string, unknown>;
    if (typeof item.code !== "string" || typeof item.label !== "string") return [];
    const rate = typeof item.rate === "number" && item.rate >= 0 ? item.rate : undefined;
    const fixedAmount =
      typeof item.fixedAmount === "number" && item.fixedAmount >= 0 ? item.fixedAmount : undefined;
    if (rate === undefined && fixedAmount === undefined) return [];
    return [{ code: item.code, label: item.label, rate, fixedAmount }];
  });
}

export async function createPayTemplate(
  tenantSlug: string,
  input: unknown,
): Promise<ActionResult & { templateId?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const parsed = createPayTemplateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }
  const duplicate = await prisma.hrPayTemplate.findFirst({
    where: {
      tenantId: tenant.id,
      countryCode: parsed.data.countryCode,
      name: { equals: parsed.data.name, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (duplicate) return { ok: false, error: "A pay template with this name already exists for that country." };

  const template = await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.hrPayTemplate.updateMany({
        where: { tenantId: tenant.id, countryCode: parsed.data.countryCode, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.hrPayTemplate.create({
      data: {
        tenantId: tenant.id,
        name: parsed.data.name,
        countryCode: parsed.data.countryCode,
        basicPercent: parsed.data.basicPercent,
        housingPercent: parsed.data.housingPercent,
        transportPercent: parsed.data.transportPercent,
        otherPercent: parsed.data.otherPercent,
        pensionEnabled: parsed.data.pensionEnabled,
        employeePensionRate: parsed.data.employeePensionRate,
        employerPensionRate: parsed.data.employerPensionRate,
        isDefault: parsed.data.isDefault ?? false,
      },
    });
  });
  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email,
    module: "HR",
    entityType: "PAY_TEMPLATE",
    entityId: template.id,
    action: "CREATE",
    summary: `Created payroll template ${template.name}.`,
  });
  revalidateHr(tenantSlug);
  return { ok: true, templateId: template.id };
}

export async function applyPayTemplate(
  tenantSlug: string,
  input: unknown,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const parsed = applyPayTemplateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }
  const [template, profile] = await Promise.all([
    prisma.hrPayTemplate.findFirst({
      where: { id: parsed.data.templateId, tenantId: tenant.id },
    }),
    prisma.employeeProfile.findFirst({
      where: { id: parsed.data.employeeProfileId, tenantId: tenant.id },
      select: { id: true, fullName: true },
    }),
  ]);
  if (!template || !profile) return { ok: false, error: "Template or employee record not found." };
  await prisma.employeeProfile.update({
    where: { id: profile.id },
    data: {
      payTemplateId: template.id,
      payrollCountryCode: template.countryCode,
      basicPercent: template.basicPercent,
      housingPercent: template.housingPercent,
      transportPercent: template.transportPercent,
      otherPercent: template.otherPercent,
      pensionEnabled: template.pensionEnabled,
      employeePensionRate: template.employeePensionRate,
      employerPensionRate: template.employerPensionRate,
    },
  });
  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email,
    module: "HR",
    entityType: "EMPLOYEE_PROFILE",
    entityId: profile.id,
    action: "APPLY_PAY_TEMPLATE",
    summary: `Applied ${template.name} to ${profile.fullName || "employee"}.`,
    metadata: { templateId: template.id },
  });
  revalidateHr(tenantSlug);
  return { ok: true };
}

function calculatedPayslipData(calc: ReturnType<typeof calculatePayroll>) {
  return {
    currency: calc.currency,
    jurisdictionCode: calc.jurisdictionCode,
    taxRuleVersion: calc.ruleVersion,
    grossPay: calc.grossPay,
    payeeTax: calc.tax,
    pensionDeduction: calc.employeePension,
    otherDeductions: calc.otherDeductions,
    chargeableIncome: calc.chargeableIncome,
    employerCost: calc.employerCost,
    netPay: calc.netPay,
    earningsBreakdown: calc.earnings as Prisma.InputJsonValue,
    deductionsBreakdown: calc.deductions as Prisma.InputJsonValue,
    employerContributions: calc.employerContributions as Prisma.InputJsonValue,
    calculationBreakdown: calc.calculationBreakdown as Prisma.InputJsonValue,
    taxOverrideApplied: calc.taxOverrideApplied,
    taxOverrideReason: calc.taxOverrideReason,
  };
}

async function calculateDraftProfilePayroll(input: {
  tenantId: string;
  tenantPayrollCountryCode?: string | null;
  tenantPayrollSettings?: Prisma.JsonValue | null;
  runId: string;
  year: number;
  month: number;
  employeeProfileId: string;
}) {
  const [profile, history, adjustments] = await Promise.all([
    prisma.employeeProfile.findFirst({
      where: { id: input.employeeProfileId, tenantId: input.tenantId },
    }),
    prisma.hrPayslip.findMany({
      where: {
        tenantId: input.tenantId,
        employeeProfileId: input.employeeProfileId,
        run: {
          status: HrPayslipRunStatus.FINALIZED,
          year: input.year,
          month: { lt: input.month },
        },
      },
      select: {
        grossPay: true,
        payeeTax: true,
        pensionDeduction: true,
        chargeableIncome: true,
        taxRuleVersion: true,
        runId: true,
      },
    }),
    prisma.hrPayrollAdjustment.findMany({
      where: {
        tenantId: input.tenantId,
        runId: input.runId,
        employeeProfileId: input.employeeProfileId,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (!profile?.grossMonthly || Number(profile.grossMonthly) <= 0) {
    throw new PayrollConfigurationError("Set this employee's recurring gross pay first.");
  }
  const priorYtd = {
    chargeableIncome: history.reduce(
      (sum, slip) =>
        sum +
        (slip.taxRuleVersion
          ? Number(slip.chargeableIncome)
          : Math.max(0, Number(slip.grossPay) - Number(slip.pensionDeduction))),
      0,
    ),
    taxWithheld: history.reduce((sum, slip) => sum + Number(slip.payeeTax), 0),
    monthsProcessed: new Set(history.map((slip) => slip.runId)).size,
  };
  return calculatePayroll({
    countryCode:
      profile.payrollCountryCode || input.tenantPayrollCountryCode || "NG",
    regionCode: profile.payrollRegionCode,
    year: input.year,
    month: input.month,
    grossMonthly: Number(profile.grossMonthly),
    basicPercent: Number(profile.basicPercent),
    housingPercent: Number(profile.housingPercent),
    transportPercent: Number(profile.transportPercent),
    otherPercent: Number(profile.otherPercent),
    pensionEnabled: profile.pensionEnabled,
    employeePensionRate: Number(profile.employeePensionRate),
    employerPensionRate: Number(profile.employerPensionRate),
    nhfMonthly: Number(profile.nhfMonthly),
    nhiaMonthly: Number(profile.nhiaMonthly),
    annualRent: Number(profile.annualRent),
    annualLifeInsurance: Number(profile.annualLifeInsurance),
    annualMortgageInterest: Number(profile.annualMortgageInterest),
    otherPreTaxMonthly: Number(profile.otherPreTaxMonthly),
    otherPostTaxMonthly: Number(profile.otherPostTaxMonthly),
    employerStatutoryContributions: employerContributionsFromSettings(
      input.tenantPayrollSettings,
    ),
    taxOverrideMonthly:
      profile.payeeTaxMonthly == null ? undefined : Number(profile.payeeTaxMonthly),
    taxOverrideReason: profile.taxOverrideReason,
    priorYtd,
    variableEarnings: adjustments
      .filter((adjustment) => adjustment.type === HrPayrollAdjustmentType.EARNING)
      .map((adjustment) => ({
        code: `ADJ_${adjustment.id}`,
        label: adjustment.label,
        amount: Number(adjustment.amount),
        taxable: adjustment.taxable,
        pensionable: adjustment.pensionable,
      })),
    variableDeductions: adjustments
      .filter((adjustment) => adjustment.type === HrPayrollAdjustmentType.DEDUCTION)
      .map((adjustment) => ({
        code: `ADJ_${adjustment.id}`,
        label: adjustment.label,
        amount: Number(adjustment.amount),
        preTax: adjustment.preTax,
      })),
  });
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

  const existingRun = await prisma.hrPayslipRun.findUnique({
    where: {
      tenantId_year_month: {
        tenantId: tenant.id,
        year: parsed.data.year,
        month: parsed.data.month,
      },
    },
  });
  if (existingRun?.status === HrPayslipRunStatus.FINALIZED) {
    return {
      ok: false,
      error: "This payroll run is finalized and immutable. Create an adjustment in a later draft period.",
    };
  }
  const earlierDraft = await prisma.hrPayslipRun.findFirst({
    where: {
      tenantId: tenant.id,
      year: parsed.data.year,
      month: { lt: parsed.data.month },
      status: HrPayslipRunStatus.DRAFT,
      payslips: { some: {} },
    },
    orderBy: { month: "asc" },
    select: { label: true },
  });
  if (earlierDraft) {
    return {
      ok: false,
      error: `Finalize ${earlierDraft.label} first so cumulative tax is calculated in chronological order.`,
    };
  }

  const profiles = await prisma.employeeProfile.findMany({
    where: {
      tenantId: tenant.id,
      status: EmployeeProfileStatus.ACTIVE,
      grossMonthly: { not: null },
      ...paygroupProfileFilter(parsed.data.paygroupName),
    },
  });
  const runAdjustments = existingRun
    ? await prisma.hrPayrollAdjustment.findMany({
        where: { tenantId: tenant.id, runId: existingRun.id },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const adjustmentsByProfile = new Map<string, typeof runAdjustments>();
  for (const adjustment of runAdjustments) {
    const rows = adjustmentsByProfile.get(adjustment.employeeProfileId) ?? [];
    rows.push(adjustment);
    adjustmentsByProfile.set(adjustment.employeeProfileId, rows);
  }

  const priorSlips = profiles.length
    ? await prisma.hrPayslip.findMany({
        where: {
          tenantId: tenant.id,
          employeeProfileId: { in: profiles.map((profile) => profile.id) },
          run: {
            status: HrPayslipRunStatus.FINALIZED,
            year: parsed.data.year,
            month: { lt: parsed.data.month },
          },
        },
        select: {
          employeeProfileId: true,
          grossPay: true,
          payeeTax: true,
          pensionDeduction: true,
          chargeableIncome: true,
          taxRuleVersion: true,
          runId: true,
        },
      })
    : [];
  const priorByProfile = new Map<string, typeof priorSlips>();
  for (const slip of priorSlips) {
    const rows = priorByProfile.get(slip.employeeProfileId) ?? [];
    rows.push(slip);
    priorByProfile.set(slip.employeeProfileId, rows);
  }

  const employerStatutoryContributions = employerContributionsFromSettings(
    tenant.settings?.payrollSettings,
  );
  const prepared: Array<{
    profileId: string;
    calc: ReturnType<typeof calculatePayroll>;
  }> = [];
  for (const profile of profiles) {
    const gross = Number(profile.grossMonthly);
    if (!gross || gross <= 0) continue;
    const payeeOverride =
      profile.payeeTaxMonthly != null && Number(profile.payeeTaxMonthly) >= 0
        ? Number(profile.payeeTaxMonthly)
        : undefined;
    const history = priorByProfile.get(profile.id) ?? [];
    const adjustments = adjustmentsByProfile.get(profile.id) ?? [];
    const priorYtd = {
      chargeableIncome: history.reduce(
        (sum, slip) =>
          sum +
          (slip.taxRuleVersion
            ? Number(slip.chargeableIncome)
            : Math.max(0, Number(slip.grossPay) - Number(slip.pensionDeduction))),
        0,
      ),
      taxWithheld: history.reduce((sum, slip) => sum + Number(slip.payeeTax), 0),
      monthsProcessed: new Set(history.map((slip) => slip.runId)).size,
    };
    try {
      prepared.push({
        profileId: profile.id,
        calc: calculatePayroll({
          countryCode: profile.payrollCountryCode || tenant.settings?.payrollCountryCode || "NG",
          regionCode: profile.payrollRegionCode,
          year: parsed.data.year,
          month: parsed.data.month,
          grossMonthly: gross,
          basicPercent: Number(profile.basicPercent),
          housingPercent: Number(profile.housingPercent),
          transportPercent: Number(profile.transportPercent),
          otherPercent: Number(profile.otherPercent),
          pensionEnabled: profile.pensionEnabled,
          employeePensionRate: Number(profile.employeePensionRate),
          employerPensionRate: Number(profile.employerPensionRate),
          nhfMonthly: Number(profile.nhfMonthly),
          nhiaMonthly: Number(profile.nhiaMonthly),
          annualRent: Number(profile.annualRent),
          annualLifeInsurance: Number(profile.annualLifeInsurance),
          annualMortgageInterest: Number(profile.annualMortgageInterest),
          otherPreTaxMonthly: Number(profile.otherPreTaxMonthly),
          otherPostTaxMonthly: Number(profile.otherPostTaxMonthly),
          variableEarnings: adjustments
            .filter((adjustment) => adjustment.type === "EARNING")
            .map((adjustment) => ({
              code: `ADJ_${adjustment.id}`,
              label: adjustment.label,
              amount: Number(adjustment.amount),
              taxable: adjustment.taxable,
              pensionable: adjustment.pensionable,
            })),
          variableDeductions: adjustments
            .filter((adjustment) => adjustment.type === "DEDUCTION")
            .map((adjustment) => ({
              code: `ADJ_${adjustment.id}`,
              label: adjustment.label,
              amount: Number(adjustment.amount),
              preTax: adjustment.preTax,
            })),
          employerStatutoryContributions,
          taxOverrideMonthly: payeeOverride,
          taxOverrideReason: profile.taxOverrideReason,
          priorYtd,
        }),
      });
    } catch (error) {
      const reason =
        error instanceof PayrollConfigurationError ? error.message : "The payroll calculation failed validation.";
      return { ok: false, error: `${profile.fullName || "An employee"}: ${reason}` };
    }
  }

  const actorLabel = session.user.name || session.user.email || "HR";
  const run = await prisma.$transaction(async (tx) => {
    const savedRun = existingRun
      ? await tx.hrPayslipRun.update({
          where: { id: existingRun.id },
          data: {
            label,
            generatedAt: new Date(),
            generatedByUserId: session.user.id,
            generatedByLabel: actorLabel,
          },
        })
      : await tx.hrPayslipRun.create({
          data: {
            tenantId: tenant.id,
            year: parsed.data.year,
            month: parsed.data.month,
            label,
            status: HrPayslipRunStatus.DRAFT,
            generatedAt: new Date(),
            generatedByUserId: session.user.id,
            generatedByLabel: actorLabel,
          },
        });

    for (const item of prepared) {
      const calc = item.calc;
      const data = calculatedPayslipData(calc);
      await tx.hrPayslip.upsert({
        where: {
          runId_employeeProfileId: {
            runId: savedRun.id,
            employeeProfileId: item.profileId,
          },
        },
        create: {
          tenantId: tenant.id,
          runId: savedRun.id,
          employeeProfileId: item.profileId,
          ...data,
        },
        update: data,
      });
    }
    return savedRun;
  });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel,
    module: "HR",
    entityType: "PAYROLL_RUN",
    entityId: run.id,
    action: existingRun ? "REGENERATE" : "GENERATE",
    summary: `${existingRun ? "Regenerated" : "Generated"} ${label} payroll for ${prepared.length} employee(s).`,
    metadata: {
      year: parsed.data.year,
      month: parsed.data.month,
      paygroupName: parsed.data.paygroupName || "ALL",
      employeeCount: prepared.length,
      ruleVersions: Array.from(new Set(prepared.map((item) => item.calc.ruleVersion))),
    },
  });
  revalidateHr(tenantSlug);
  return { ok: true, count: prepared.length };
}

export async function savePayrollAdjustment(
  tenantSlug: string,
  input: unknown,
): Promise<ActionResult & { adjustmentId?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const parsed = savePayrollAdjustmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join(" ") };
  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }
  const run = await prisma.hrPayslipRun.findFirst({
    where: {
      id: parsed.data.runId,
      tenantId: tenant.id,
      status: HrPayslipRunStatus.DRAFT,
      payslips: { some: { employeeProfileId: parsed.data.employeeProfileId } },
    },
    select: { id: true, year: true, month: true, label: true },
  });
  if (!run) return { ok: false, error: "Adjustments can only be added to an existing draft payslip." };

  const actorLabel = session.user.name || session.user.email || "HR";
  const adjustment = await prisma.hrPayrollAdjustment.create({
    data: {
      tenantId: tenant.id,
      runId: run.id,
      employeeProfileId: parsed.data.employeeProfileId,
      type: parsed.data.type as HrPayrollAdjustmentType,
      code: parsed.data.label
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
        .slice(0, 40) || "ADJUSTMENT",
      label: parsed.data.label,
      amount: parsed.data.amount,
      taxable: parsed.data.type === "EARNING" ? (parsed.data.taxable ?? true) : false,
      pensionable: parsed.data.type === "EARNING" ? (parsed.data.pensionable ?? false) : false,
      preTax: parsed.data.type === "DEDUCTION" ? (parsed.data.preTax ?? false) : false,
      createdByUserId: session.user.id,
      createdByLabel: actorLabel,
    },
  });

  try {
    const calc = await calculateDraftProfilePayroll({
      tenantId: tenant.id,
      tenantPayrollCountryCode: tenant.settings?.payrollCountryCode,
      tenantPayrollSettings: tenant.settings?.payrollSettings,
      runId: run.id,
      year: run.year,
      month: run.month,
      employeeProfileId: parsed.data.employeeProfileId,
    });
    await prisma.hrPayslip.update({
      where: {
        runId_employeeProfileId: {
          runId: run.id,
          employeeProfileId: parsed.data.employeeProfileId,
        },
      },
      data: calculatedPayslipData(calc),
    });
  } catch (error) {
    await prisma.hrPayrollAdjustment.delete({ where: { id: adjustment.id } });
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not recalculate this draft payslip.",
    };
  }

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel,
    module: "HR",
    entityType: "PAYROLL_ADJUSTMENT",
    entityId: adjustment.id,
    action: "CREATE",
    summary: `Added ${adjustment.label} to ${run.label}.`,
    metadata: {
      runId: run.id,
      employeeProfileId: parsed.data.employeeProfileId,
      type: adjustment.type,
      amount: Number(adjustment.amount),
      taxable: adjustment.taxable,
      pensionable: adjustment.pensionable,
      preTax: adjustment.preTax,
    },
  });
  revalidateHr(tenantSlug);
  return { ok: true, adjustmentId: adjustment.id };
}

export async function deletePayrollAdjustment(
  tenantSlug: string,
  adjustmentId: string,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission." };
  }
  const adjustment = await prisma.hrPayrollAdjustment.findFirst({
    where: {
      id: adjustmentId,
      tenantId: tenant.id,
      run: { status: HrPayslipRunStatus.DRAFT },
    },
    include: { run: { select: { id: true, year: true, month: true, label: true } } },
  });
  if (!adjustment) return { ok: false, error: "Draft payroll adjustment not found." };
  await prisma.hrPayrollAdjustment.delete({ where: { id: adjustment.id } });
  try {
    const calc = await calculateDraftProfilePayroll({
      tenantId: tenant.id,
      tenantPayrollCountryCode: tenant.settings?.payrollCountryCode,
      tenantPayrollSettings: tenant.settings?.payrollSettings,
      runId: adjustment.run.id,
      year: adjustment.run.year,
      month: adjustment.run.month,
      employeeProfileId: adjustment.employeeProfileId,
    });
    await prisma.hrPayslip.update({
      where: {
        runId_employeeProfileId: {
          runId: adjustment.run.id,
          employeeProfileId: adjustment.employeeProfileId,
        },
      },
      data: calculatedPayslipData(calc),
    });
  } catch (error) {
    await prisma.hrPayrollAdjustment.create({
      data: {
        id: adjustment.id,
        tenantId: adjustment.tenantId,
        runId: adjustment.runId,
        employeeProfileId: adjustment.employeeProfileId,
        type: adjustment.type,
        code: adjustment.code,
        label: adjustment.label,
        amount: adjustment.amount,
        taxable: adjustment.taxable,
        pensionable: adjustment.pensionable,
        preTax: adjustment.preTax,
        createdByUserId: adjustment.createdByUserId,
        createdByLabel: adjustment.createdByLabel,
        createdAt: adjustment.createdAt,
      },
    });
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not recalculate this draft payslip.",
    };
  }
  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: session.user.name || session.user.email,
    module: "HR",
    entityType: "PAYROLL_ADJUSTMENT",
    entityId: adjustment.id,
    action: "DELETE",
    summary: `Removed ${adjustment.label} from ${adjustment.run.label}.`,
  });
  revalidateHr(tenantSlug);
  return { ok: true };
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
  if (run.status === HrPayslipRunStatus.FINALIZED) {
    return { ok: false, error: "This payroll run is already finalized." };
  }
  if (run._count.payslips === 0) {
    return {
      ok: false,
      error: "No payslips in this run. Generate payslips first (employees need gross pay on People → Job).",
    };
  }
  const earlierDraft = await prisma.hrPayslipRun.findFirst({
    where: {
      tenantId: tenant.id,
      year: run.year,
      month: { lt: run.month },
      status: HrPayslipRunStatus.DRAFT,
      payslips: { some: {} },
    },
    orderBy: { month: "asc" },
    select: { label: true },
  });
  if (earlierDraft) {
    return {
      ok: false,
      error: `Finalize ${earlierDraft.label} first so cumulative tax remains chronologically correct.`,
    };
  }

  const invalidSnapshots = await prisma.hrPayslip.count({
    where: {
      runId: run.id,
      OR: [
        { taxRuleVersion: null },
        { AND: [{ taxOverrideApplied: true }, { taxOverrideReason: null }] },
      ],
    },
  });
  if (invalidSnapshots > 0) {
    return {
      ok: false,
      error: "Regenerate this draft with the current payroll engine before finalizing it.",
    };
  }

  const actorLabel = session.user.name || session.user.email || "HR";
  const result = await prisma.hrPayslipRun.updateMany({
    where: { id: runId, tenantId: tenant.id, status: HrPayslipRunStatus.DRAFT },
    data: {
      status: HrPayslipRunStatus.FINALIZED,
      finalizedAt: new Date(),
      finalizedByUserId: session.user.id,
      finalizedByLabel: actorLabel,
    },
  });
  if (result.count !== 1) return { ok: false, error: "Payroll changed while publishing. Refresh and try again." };
  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel,
    module: "HR",
    entityType: "PAYROLL_RUN",
    entityId: run.id,
    action: "FINALIZE",
    summary: `Finalized ${run.label} payroll with ${run._count.payslips} payslip(s).`,
    metadata: { year: run.year, month: run.month, payslipCount: run._count.payslips },
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
      disbursementChannel: paid ? "MANUAL" : null,
      disbursementStatus: paid ? "SETTLED" : null,
    },
  });

  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel: label,
    module: "HR",
    entityType: "PAYSLIP",
    action: paid ? "MARK_PAID" : "MARK_PENDING",
    summary: `${paid ? "Marked" : "Reverted"} ${slips.length} payslip payment(s) ${paid ? "as paid" : "to pending"}.`,
    metadata: {
      payslipIds: slips.map((slip) => slip.id),
      paymentReference: paid ? parsed.data.paymentReference || null : null,
    },
  });
  revalidateHr(tenantSlug);
  return { ok: true, count: slips.length };
}

export async function finalizeAllDraftPayslipRuns(
  tenantSlug: string,
): Promise<ActionResult & { count?: number }> {
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
  if (publishable.length > 1) {
    const oldest = [...publishable].sort((a, b) => a.year - b.year || a.month - b.month)[0];
    return {
      ok: false,
      error: `Publish ${oldest.label} first, then regenerate later drafts so cumulative tax can true-up correctly.`,
    };
  }

  const invalidRunIds = new Set(
    (
      await prisma.hrPayslip.findMany({
        where: {
          runId: { in: publishable.map((r) => r.id) },
          OR: [
            { taxRuleVersion: null },
            { AND: [{ taxOverrideApplied: true }, { taxOverrideReason: null }] },
          ],
        },
        select: { runId: true },
        distinct: ["runId"],
      })
    ).map((slip) => slip.runId),
  );
  const safeRuns = publishable.filter((run) => !invalidRunIds.has(run.id));
  if (safeRuns.length === 0) {
    return { ok: false, error: "Regenerate draft payroll runs with the current engine before publishing." };
  }
  const actorLabel = session.user.name || session.user.email || "HR";
  const result = await prisma.hrPayslipRun.updateMany({
    where: { id: { in: safeRuns.map((r) => r.id) }, status: HrPayslipRunStatus.DRAFT },
    data: {
      status: HrPayslipRunStatus.FINALIZED,
      finalizedAt: new Date(),
      finalizedByUserId: session.user.id,
      finalizedByLabel: actorLabel,
    },
  });

  for (const run of safeRuns) {
    await writeAuditLog({
      tenantId: tenant.id,
      actorUserId: session.user.id,
      actorLabel,
      module: "HR",
      entityType: "PAYROLL_RUN",
      entityId: run.id,
      action: "FINALIZE",
      summary: `Finalized ${run.label} payroll with ${run._count.payslips} payslip(s).`,
    });
  }
  revalidateHr(tenantSlug);
  return { ok: true, count: result.count };
}

async function resolveEmployeeProfileId(
  tenantId: string,
  input: { employeeProfileId?: string; userId?: string },
) {
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

export async function addHrDocument(
  tenantSlug: string,
  input: Record<string, unknown>,
): Promise<ActionResult> {
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

export async function softDeleteHrDocument(tenantSlug: string, documentId: string): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." };
  const parsedId = z.string().trim().min(1).safeParse(documentId);
  if (!parsedId.success) return { ok: false, error: "Document not found." };

  const { tenant, membership } = await getTenantAndMembership(tenantSlug, session.user.id);
  if (!tenant) return { ok: false, error: "Organization not found." };
  if (!canManageHr(Boolean(session.user.isPlatformAdmin), membership)) {
    return { ok: false, error: "You do not have permission to remove HR documents." };
  }

  const document = await prisma.hrDocument.findFirst({
    where: { id: parsedId.data, tenantId: tenant.id, deletedAt: null },
    select: { id: true, title: true, fileName: true, employeeProfileId: true },
  });
  if (!document) return { ok: false, error: "This document was already removed or could not be found." };

  const actorLabel = session.user.name || session.user.email || "HR";
  await prisma.hrDocument.update({
    where: { id: document.id },
    data: {
      deletedAt: new Date(),
      deletedByUserId: session.user.id,
      deletedByLabel: actorLabel,
    },
  });
  await writeAuditLog({
    tenantId: tenant.id,
    actorUserId: session.user.id,
    actorLabel,
    module: "HR",
    entityType: "HrDocument",
    entityId: document.id,
    action: "DOCUMENT_REMOVED",
    summary: `${document.fileName || document.title} removed from the employee document library.`,
    metadata: { employeeProfileId: document.employeeProfileId, softDeleted: true },
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
    if (!member)
      return { ok: false, error: "That person is not on your Team list. Add them under Team first." };

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

  let approvedProfileId = req.employeeProfileId;
  if (!approvedProfileId && req.recipientName?.trim()) {
    const recipientEmail = req.recipientEmail?.trim().toLowerCase() || null;
    const externalUser = recipientEmail
      ? await prisma.user.upsert({
          where: { email: recipientEmail },
          create: { name: req.recipientName.trim(), email: recipientEmail },
          update: {},
          select: { id: true },
        })
      : await prisma.user.create({ data: { name: req.recipientName.trim() }, select: { id: true } });
    const externalProfile = await prisma.employeeProfile.upsert({
      where: { tenantId_userId: { tenantId: tenant.id, userId: externalUser.id } },
      create: {
        tenantId: tenant.id,
        userId: externalUser.id,
        fullName: req.recipientName.trim(),
        workEmail: recipientEmail,
        status: EmployeeProfileStatus.DRAFT,
        hrNotes: "Created from an approved external onboarding submission; no login access granted.",
      },
      update: {},
      select: { id: true },
    });
    approvedProfileId = externalProfile.id;
    await prisma.hrFormRequest.update({
      where: { id: req.id },
      data: { employeeProfileId: approvedProfileId },
    });
  }

  if (req.submittedPayload && approvedProfileId) {
    await prisma.employeeProfile.update({
      where: { id: approvedProfileId },
      data: mergeHrFormIntoProfile(req.formType, req.submittedPayload),
    });
    await ensureEmployeeNumber(approvedProfileId);
  }

  if (req.submittedFileUrl && approvedProfileId) {
    const categoryLabel = req.hrNote?.match(/AI document intake · ([A-Z_]+) ·/)?.[1];
    const category = Object.values(HrDocumentCategory).includes(categoryLabel as HrDocumentCategory)
      ? (categoryLabel as HrDocumentCategory)
      : req.formType === HrFormType.HEALTH
        ? HrDocumentCategory.HEALTH_RECORD
        : (req.formType as HrDocumentCategory);
    const alreadyFiled = await prisma.hrDocument.findFirst({
      where: {
        tenantId: tenant.id,
        employeeProfileId: approvedProfileId,
        fileUrl: req.submittedFileUrl,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!alreadyFiled) {
      await prisma.hrDocument.create({
        data: {
          tenantId: tenant.id,
          employeeProfileId: approvedProfileId,
          category,
          title: `${HR_FORM_TYPE_LABELS[req.formType]} — approved document`,
          fileUrl: req.submittedFileUrl,
          fileName: req.submittedFileName,
          uploadedByUserId: session.user.id,
          uploadedByLabel: session.user.name || session.user.email || "HR",
        },
      });
    }
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

export async function approveHrFormRequestsBatch(
  tenantSlug: string,
  requestIds: string[],
): Promise<ActionResult & { approvedCount?: number }> {
  const parsed = z.array(z.string().min(1)).min(1).max(100).safeParse([...new Set(requestIds)]);
  if (!parsed.success) return { ok: false, error: "Select between 1 and 100 submitted records." };

  let approvedCount = 0;
  const failures: string[] = [];
  for (const requestId of parsed.data) {
    try {
      const result = await approveHrFormRequest(tenantSlug, requestId);
      if (result.ok) approvedCount += 1;
      else failures.push(result.error);
    } catch (error) {
      console.error("Bulk HR approval failed for a submitted record.", error);
      failures.push("A record could not be approved because its database update failed.");
    }
  }
  if (!approvedCount) return { ok: false, error: failures[0] || "No records were approved." };
  return {
    ok: true,
    approvedCount,
    ...(failures.length ? { error: `${failures.length} record${failures.length === 1 ? "" : "s"} skipped.` } : {}),
  };
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
