"use server";

import { auth } from "@/auth";
import {
  EmployeeProfileStatus,
  HrLeaveAccrualMethod,
  HrLeaveDayUnit,
  HrLeaveRequestStatus,
  MembershipStatus,
  Prisma,
} from "@/generated/prisma";
import { writeAuditLog } from "@/lib/audit-log";
import { createTenantUploadSignature } from "@/lib/cloudinary-upload-server";
import prisma from "@/lib/db";
import { canManageHr } from "@/lib/hr-access";
import { countLeaveUnits, leaveDateKey, leaveTypeEligibleForGender, parseLeaveDate } from "@/lib/hr-leave";
import {
  ensureDefaultLeaveTypes,
  loadLeaveBalanceSummaries,
} from "@/lib/hr-leave-server";
import { syncPublicHolidaysForTenant } from "@/lib/org-calendar-jobs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const requestSchema = z.object({
  leaveTypeId: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().trim().max(1000).optional(),
  attachmentUrl: z.string().url().optional().or(z.literal("")),
  requestedHours: z.coerce.number().positive().max(240).optional(),
});

const leaveTypeSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(2).max(40),
  countryCode: z.string().trim().toUpperCase().length(2).optional().or(z.literal("")),
  department: z.string().trim().max(80).optional().or(z.literal("")),
  dayUnit: z.nativeEnum(HrLeaveDayUnit),
  accrualMethod: z.nativeEnum(HrLeaveAccrualMethod),
  annualEntitlement: z.coerce.number().min(0).max(1000),
  paidPercentage: z.coerce.number().min(0).max(100),
  minimumServiceMonths: z.coerce.number().int().min(0).max(600),
  carryoverEnabled: z.coerce.boolean().optional(),
  maxCarryoverUnits: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().min(0).max(1000).optional(),
  ),
  allowNegativeBalance: z.coerce.boolean().optional(),
  unlimited: z.coerce.boolean().optional(),
  requiresDocumentAfterUnits: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().min(0).max(1000).optional(),
  ),
  statutoryReference: z.string().trim().max(500).optional(),
});

async function leaveContext(tenantSlug: string) {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "You must be signed in." } as const;
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      slug: true,
      settings: { select: { payrollCountryCode: true } },
    },
  });
  if (!tenant) return { ok: false, error: "Organization not found." } as const;
  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { status: true, role: true },
  });
  if (membership?.status !== MembershipStatus.ACTIVE && !session.user.isPlatformAdmin) {
    return { ok: false, error: "You do not have access to this organization." } as const;
  }
  return { ok: true, session, tenant, membership } as const;
}

function revalidateLeave(tenantSlug: string) {
  revalidatePath(`/${tenantSlug}/hr`);
  revalidatePath(`/${tenantSlug}/hr/leave`);
  revalidatePath(`/${tenantSlug}/hr/dashboard`);
  revalidatePath(`/${tenantSlug}/hr/my`);
}

export async function getLeaveUploadSignature(
  tenantSlug: string,
  fileName?: string,
) {
  const ctx = await leaveContext(tenantSlug);
  if (!ctx.ok) return { ok: false as const, error: ctx.error };
  return createTenantUploadSignature({
    tenantId: ctx.tenant.id,
    tenantSlug,
    area: "hr",
    fileName,
    publicIdPrefix: "leave-evidence",
  });
}

export async function requestLeave(
  tenantSlug: string,
  input: unknown,
): Promise<{ ok: true; requestId: string } | { ok: false; error: string }> {
  const ctx = await leaveContext(tenantSlug);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((issue) => issue.message).join(" ") };

  const profile = await prisma.employeeProfile.findUnique({
    where: {
      tenantId_userId: {
        tenantId: ctx.tenant.id,
        userId: ctx.session.user.id,
      },
    },
  });
  if (!profile || profile.status !== EmployeeProfileStatus.ACTIVE) {
    return { ok: false, error: "Your employee profile must be active before requesting leave." };
  }
  await ensureDefaultLeaveTypes(
    ctx.tenant.id,
    profile.payrollCountryCode || ctx.tenant.settings?.payrollCountryCode || "NG",
  );
  const leaveType = await prisma.hrLeaveType.findFirst({
    where: {
      id: parsed.data.leaveTypeId,
      tenantId: ctx.tenant.id,
      isActive: true,
      AND: [
        {
          OR: [
            { countryCode: null },
            {
              countryCode:
                profile.payrollCountryCode || ctx.tenant.settings?.payrollCountryCode || "NG",
            },
          ],
        },
        profile.department
          ? { OR: [{ department: null }, { department: profile.department }] }
          : { department: null },
      ],
    },
  });
  if (!leaveType) return { ok: false, error: "This leave policy is not available to you." };
  if (!leaveTypeEligibleForGender(leaveType, profile.gender)) {
    return {
      ok: false,
      error:
        leaveType.name.toLowerCase().includes("maternity") ||
        leaveType.code.toUpperCase().includes("MATERNITY")
          ? "Maternity leave is only available to female employees. Set gender to Female on the HR record if this is incorrect."
          : leaveType.name.toLowerCase().includes("paternity") ||
              leaveType.code.toUpperCase().includes("PATERNITY")
            ? "Paternity leave is only available to male employees."
            : "You are not eligible for this leave type.",
    };
  }

  let startDate: Date;
  let endDate: Date;
  try {
    startDate = parseLeaveDate(parsed.data.startDate);
    endDate = parseLeaveDate(parsed.data.endDate);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid leave dates." };
  }
  if (startDate.getUTCFullYear() !== endDate.getUTCFullYear()) {
    return { ok: false, error: "Submit separate leave requests for each calendar year." };
  }
  const overlapping = await prisma.hrLeaveRequest.findFirst({
    where: {
      tenantId: ctx.tenant.id,
      employeeProfileId: profile.id,
      status: { in: [HrLeaveRequestStatus.PENDING, HrLeaveRequestStatus.APPROVED] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    },
    select: { id: true },
  });
  if (overlapping) return { ok: false, error: "You already have pending or approved leave in this period." };

  const holidays = await prisma.hrHoliday.findMany({
    where: {
      tenantId: ctx.tenant.id,
      date: { gte: startDate, lte: endDate },
      AND: [
        {
          OR: [
            { countryCode: null },
            { countryCode: profile.payrollCountryCode },
          ],
        },
        profile.payrollRegionCode
          ? { OR: [{ regionCode: null }, { regionCode: profile.payrollRegionCode }] }
          : { regionCode: null },
      ],
    },
    select: { date: true },
  });
  let requestedUnits: number;
  try {
    requestedUnits =
      leaveType.dayUnit === HrLeaveDayUnit.HOURS && parsed.data.requestedHours
        ? parsed.data.requestedHours
        : countLeaveUnits({
            startDate,
            endDate,
            dayUnit: leaveType.dayUnit,
            holidayDates: holidays.map((holiday) => leaveDateKey(holiday.date)),
          });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not calculate leave duration." };
  }
  if (requestedUnits <= 0) return { ok: false, error: "The selected dates contain no leave units." };
  if (
    leaveType.requiresDocumentAfterUnits != null &&
    requestedUnits > Number(leaveType.requiresDocumentAfterUnits) &&
    !parsed.data.attachmentUrl
  ) {
    return { ok: false, error: `${leaveType.name} requires supporting evidence for this duration.` };
  }

  const year = startDate.getUTCFullYear();
  const summaries = await loadLeaveBalanceSummaries({
    tenantId: ctx.tenant.id,
    employeeProfileId: profile.id,
    payrollCountryCode:
      profile.payrollCountryCode || ctx.tenant.settings?.payrollCountryCode || "NG",
    department: profile.department,
    dateOfJoining: profile.dateOfJoining,
    gender: profile.gender,
    year,
    asOf: startDate,
  });
  const balance = summaries.find((summary) => summary.leaveType.id === leaveType.id);
  if (!balance) return { ok: false, error: "Leave balance could not be calculated." };
  if (!leaveType.allowNegativeBalance && !leaveType.unlimited && requestedUnits > balance.available) {
    return {
      ok: false,
      error: `You have ${balance.available} ${leaveType.dayUnit.toLowerCase().replace("_", " ")} available.`,
    };
  }

  const request = await prisma.hrLeaveRequest.create({
    data: {
      tenantId: ctx.tenant.id,
      employeeProfileId: profile.id,
      leaveTypeId: leaveType.id,
      startDate,
      endDate,
      requestedUnits,
      reason: parsed.data.reason || null,
      attachmentUrl: parsed.data.attachmentUrl || null,
      policySnapshot: {
        name: leaveType.name,
        code: leaveType.code,
        dayUnit: leaveType.dayUnit,
        accrualMethod: leaveType.accrualMethod,
        annualEntitlement: Number(leaveType.annualEntitlement),
        paidPercentage: Number(leaveType.paidPercentage),
        statutoryReference: leaveType.statutoryReference,
      } satisfies Prisma.InputJsonValue,
    },
  });
  await writeAuditLog({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.session.user.id,
    actorLabel: ctx.session.user.name || ctx.session.user.email,
    module: "HR",
    entityType: "LEAVE_REQUEST",
    entityId: request.id,
    action: "REQUEST",
    summary: `${profile.fullName || "Employee"} requested ${requestedUnits} unit(s) of ${leaveType.name}.`,
  });
  revalidateLeave(tenantSlug);
  return { ok: true, requestId: request.id };
}

export async function cancelLeaveRequest(
  tenantSlug: string,
  requestId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await leaveContext(tenantSlug);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const request = await prisma.hrLeaveRequest.findFirst({
    where: {
      id: requestId,
      tenantId: ctx.tenant.id,
      profile: { userId: ctx.session.user.id },
      status: HrLeaveRequestStatus.PENDING,
    },
    select: { id: true },
  });
  if (!request) return { ok: false, error: "Only your pending leave requests can be cancelled." };
  await prisma.hrLeaveRequest.update({
    where: { id: request.id },
    data: { status: HrLeaveRequestStatus.CANCELLED, cancelledAt: new Date() },
  });
  await writeAuditLog({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.session.user.id,
    actorLabel: ctx.session.user.name || ctx.session.user.email,
    module: "HR",
    entityType: "LEAVE_REQUEST",
    entityId: request.id,
    action: "CANCEL",
    summary: "Employee cancelled a pending leave request.",
  });
  revalidateLeave(tenantSlug);
  return { ok: true };
}

export async function reviewLeaveRequest(
  tenantSlug: string,
  input: { requestId: string; decision: "APPROVED" | "REJECTED"; note?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await leaveContext(tenantSlug);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!canManageHr(Boolean(ctx.session.user.isPlatformAdmin), ctx.membership)) {
    return { ok: false, error: "You do not have permission to review leave." };
  }
  const parsed = z
    .object({
      requestId: z.string().min(1),
      decision: z.enum(["APPROVED", "REJECTED"]),
      note: z.string().trim().max(1000).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid leave decision." };
  const request = await prisma.hrLeaveRequest.findFirst({
    where: {
      id: parsed.data.requestId,
      tenantId: ctx.tenant.id,
      status: HrLeaveRequestStatus.PENDING,
    },
    include: { profile: true, leaveType: true },
  });
  if (!request) return { ok: false, error: "This leave request is no longer pending." };
  if (
    parsed.data.decision === "APPROVED" &&
    !leaveTypeEligibleForGender(request.leaveType, request.profile.gender)
  ) {
    return {
      ok: false,
      error:
        "Cannot approve: this leave type is not available for this employee’s gender (maternity is female-only).",
    };
  }
  if (parsed.data.decision === "APPROVED" && !request.leaveType.allowNegativeBalance && !request.leaveType.unlimited) {
    const summaries = await loadLeaveBalanceSummaries({
      tenantId: ctx.tenant.id,
      employeeProfileId: request.employeeProfileId,
      payrollCountryCode:
        request.profile.payrollCountryCode || ctx.tenant.settings?.payrollCountryCode || "NG",
      department: request.profile.department,
      dateOfJoining: request.profile.dateOfJoining,
      gender: request.profile.gender,
      year: request.startDate.getUTCFullYear(),
      asOf: request.startDate,
    });
    const balance = summaries.find((summary) => summary.leaveType.id === request.leaveTypeId);
    if (!balance || balance.available < 0) {
      return { ok: false, error: "This request now exceeds the employee's available balance." };
    }
  }
  const actorLabel = ctx.session.user.name || ctx.session.user.email || "HR";
  await prisma.hrLeaveRequest.update({
    where: { id: request.id },
    data: {
      status:
        parsed.data.decision === "APPROVED"
          ? HrLeaveRequestStatus.APPROVED
          : HrLeaveRequestStatus.REJECTED,
      reviewedByUserId: ctx.session.user.id,
      reviewedByLabel: actorLabel,
      reviewNote: parsed.data.note || null,
      reviewedAt: new Date(),
    },
  });
  await writeAuditLog({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.session.user.id,
    actorLabel,
    module: "HR",
    entityType: "LEAVE_REQUEST",
    entityId: request.id,
    action: parsed.data.decision,
    summary: `${actorLabel} ${parsed.data.decision.toLowerCase()} ${request.profile.fullName || "employee"}'s leave request.`,
  });
  revalidateLeave(tenantSlug);
  return { ok: true };
}

export async function createLeaveType(
  tenantSlug: string,
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await leaveContext(tenantSlug);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!canManageHr(Boolean(ctx.session.user.isPlatformAdmin), ctx.membership)) {
    return { ok: false, error: "You do not have permission to configure leave." };
  }
  const parsed = leaveTypeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((issue) => issue.message).join(" ") };
  const code = parsed.data.code.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  const duplicate = await prisma.hrLeaveType.findFirst({
    where: {
      tenantId: ctx.tenant.id,
      code,
      countryCode: parsed.data.countryCode || null,
      department: parsed.data.department || null,
    },
    select: { id: true },
  });
  if (duplicate) return { ok: false, error: "A matching leave policy code already exists." };
  const type = await prisma.hrLeaveType.create({
    data: {
      tenantId: ctx.tenant.id,
      name: parsed.data.name,
      code,
      countryCode: parsed.data.countryCode || null,
      department: parsed.data.department || null,
      dayUnit: parsed.data.dayUnit,
      accrualMethod: parsed.data.accrualMethod,
      annualEntitlement: parsed.data.annualEntitlement,
      paidPercentage: parsed.data.paidPercentage,
      minimumServiceMonths: parsed.data.minimumServiceMonths,
      carryoverEnabled: parsed.data.carryoverEnabled ?? false,
      maxCarryoverUnits: parsed.data.maxCarryoverUnits ?? 0,
      allowNegativeBalance: parsed.data.allowNegativeBalance ?? false,
      unlimited: parsed.data.unlimited ?? false,
      requiresDocumentAfterUnits: parsed.data.requiresDocumentAfterUnits,
      statutoryReference: parsed.data.statutoryReference || null,
      lastReviewedAt: new Date(),
    },
  });
  await writeAuditLog({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.session.user.id,
    actorLabel: ctx.session.user.name || ctx.session.user.email,
    module: "HR",
    entityType: "LEAVE_TYPE",
    entityId: type.id,
    action: "CREATE",
    summary: `Created leave policy ${type.name}.`,
  });
  revalidateLeave(tenantSlug);
  return { ok: true };
}

export async function updateLeaveType(
  tenantSlug: string,
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await leaveContext(tenantSlug);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!canManageHr(Boolean(ctx.session.user.isPlatformAdmin), ctx.membership)) {
    return { ok: false, error: "You do not have permission to configure leave." };
  }
  const parsed = leaveTypeSchema.extend({ id: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((issue) => issue.message).join(" ") };
  const existing = await prisma.hrLeaveType.findFirst({
    where: { id: parsed.data.id, tenantId: ctx.tenant.id },
    select: { id: true, name: true },
  });
  if (!existing) return { ok: false, error: "That leave policy was not found." };
  const type = await prisma.hrLeaveType.update({
    where: { id: existing.id },
    data: {
      name: parsed.data.name,
      dayUnit: parsed.data.dayUnit,
      accrualMethod: parsed.data.accrualMethod,
      annualEntitlement: parsed.data.annualEntitlement,
      paidPercentage: parsed.data.paidPercentage,
      minimumServiceMonths: parsed.data.minimumServiceMonths,
      carryoverEnabled: parsed.data.carryoverEnabled ?? false,
      maxCarryoverUnits: parsed.data.maxCarryoverUnits ?? 0,
      allowNegativeBalance: parsed.data.allowNegativeBalance ?? false,
      unlimited: parsed.data.unlimited ?? false,
      requiresDocumentAfterUnits: parsed.data.requiresDocumentAfterUnits ?? null,
      statutoryReference: parsed.data.statutoryReference || null,
      lastReviewedAt: new Date(),
    },
  });
  await writeAuditLog({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.session.user.id,
    actorLabel: ctx.session.user.name || ctx.session.user.email,
    module: "HR",
    entityType: "LEAVE_TYPE",
    entityId: type.id,
    action: "UPDATE",
    summary: `Updated leave policy ${type.name} to ${parsed.data.annualEntitlement} days.`,
  });
  revalidateLeave(tenantSlug);
  return { ok: true };
}

export async function adjustLeaveBalance(
  tenantSlug: string,
  input: {
    employeeProfileId: string;
    leaveTypeId: string;
    year: number;
    adjustmentUnits: number;
    reason: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await leaveContext(tenantSlug);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!canManageHr(Boolean(ctx.session.user.isPlatformAdmin), ctx.membership)) {
    return { ok: false, error: "You do not have permission to adjust leave balances." };
  }
  const parsed = z
    .object({
      employeeProfileId: z.string().min(1),
      leaveTypeId: z.string().min(1),
      year: z.coerce.number().int().min(2020).max(2100),
      adjustmentUnits: z.coerce.number().min(-1000).max(1000),
      reason: z.string().trim().min(3).max(500),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((issue) => issue.message).join(" ") };
  const [profile, leaveType] = await Promise.all([
    prisma.employeeProfile.findFirst({
      where: { id: parsed.data.employeeProfileId, tenantId: ctx.tenant.id },
      select: { id: true, fullName: true },
    }),
    prisma.hrLeaveType.findFirst({
      where: { id: parsed.data.leaveTypeId, tenantId: ctx.tenant.id },
      select: { id: true, name: true },
    }),
  ]);
  if (!profile || !leaveType) return { ok: false, error: "Employee or leave policy not found." };
  const actorLabel = ctx.session.user.name || ctx.session.user.email || "HR";
  const existing = await prisma.hrLeaveBalance.findUnique({
    where: {
      employeeProfileId_leaveTypeId_year: {
        employeeProfileId: profile.id,
        leaveTypeId: leaveType.id,
        year: parsed.data.year,
      },
    },
    select: { adjustmentUnits: true },
  });
  // Input is a delta (+9 add days, −5 deduct), not a replacement of the stored adjustment.
  const nextAdjustment = Number(existing?.adjustmentUnits ?? 0) + parsed.data.adjustmentUnits;
  await prisma.hrLeaveBalance.upsert({
    where: {
      employeeProfileId_leaveTypeId_year: {
        employeeProfileId: profile.id,
        leaveTypeId: leaveType.id,
        year: parsed.data.year,
      },
    },
    create: {
      tenantId: ctx.tenant.id,
      employeeProfileId: profile.id,
      leaveTypeId: leaveType.id,
      year: parsed.data.year,
      adjustmentUnits: nextAdjustment,
      adjustmentReason: parsed.data.reason,
      adjustedByUserId: ctx.session.user.id,
      adjustedByLabel: actorLabel,
    },
    update: {
      adjustmentUnits: nextAdjustment,
      adjustmentReason: parsed.data.reason,
      adjustedByUserId: ctx.session.user.id,
      adjustedByLabel: actorLabel,
    },
  });
  await writeAuditLog({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.session.user.id,
    actorLabel,
    module: "HR",
    entityType: "LEAVE_BALANCE",
    entityId: `${profile.id}:${leaveType.id}:${parsed.data.year}`,
    action: "ADJUST",
    summary: `Adjusted ${profile.fullName || "employee"}'s ${leaveType.name} by ${parsed.data.adjustmentUnits > 0 ? "+" : ""}${parsed.data.adjustmentUnits} (total adjustment now ${nextAdjustment > 0 ? "+" : ""}${nextAdjustment}).`,
    metadata: {
      reason: parsed.data.reason,
      delta: parsed.data.adjustmentUnits,
      previousAdjustment: existing?.adjustmentUnits ?? 0,
      nextAdjustment,
    },
  });
  revalidateLeave(tenantSlug);
  return { ok: true };
}

/** Set annual leave to 22 for everyone and clear test adjustments / leave requests for the year. */
export async function resetAnnualLeaveToTwentyTwo(
  tenantSlug: string,
): Promise<{ ok: true; clearedRequests: number } | { ok: false; error: string }> {
  const ctx = await leaveContext(tenantSlug);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!canManageHr(Boolean(ctx.session.user.isPlatformAdmin), ctx.membership)) {
    return { ok: false, error: "You do not have permission to reset leave." };
  }

  const year = new Date().getUTCFullYear();
  const countryCode = ctx.tenant.settings?.payrollCountryCode || "NG";
  await ensureDefaultLeaveTypes(ctx.tenant.id, countryCode);

  const annualType = await prisma.hrLeaveType.findFirst({
    where: {
      tenantId: ctx.tenant.id,
      isActive: true,
      OR: [{ code: "ANNUAL-NG" }, { name: { equals: "Annual leave", mode: "insensitive" } }],
    },
    orderBy: { code: "asc" },
  });
  if (!annualType) {
    return { ok: false, error: "Annual leave policy was not found. Create it under Leave policies first." };
  }

  await prisma.hrLeaveType.update({
    where: { id: annualType.id },
    data: {
      annualEntitlement: 22,
      dayUnit: HrLeaveDayUnit.WORKING_DAYS,
      accrualMethod: HrLeaveAccrualMethod.ANNUAL_GRANT,
      unlimited: false,
      minimumServiceMonths: 0,
      paidPercentage: 100,
      lastReviewedAt: new Date(),
      statutoryReference:
        annualType.statutoryReference ||
        "Organization policy (Labour Act s.18 floor is 6 working days after 12 months)",
    },
  });

  await prisma.hrLeaveBalance.updateMany({
    where: {
      tenantId: ctx.tenant.id,
      leaveTypeId: annualType.id,
      year,
    },
    data: {
      adjustmentUnits: 0,
      adjustmentReason: "Reset to 22-day annual leave (cleared test adjustments)",
      adjustedByUserId: ctx.session.user.id,
      adjustedByLabel: ctx.session.user.name || ctx.session.user.email || "HR",
      carriedUnits: 0,
    },
  });

  const cleared = await prisma.hrLeaveRequest.updateMany({
    where: {
      tenantId: ctx.tenant.id,
      leaveTypeId: annualType.id,
      startDate: {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      },
      status: { in: [HrLeaveRequestStatus.PENDING, HrLeaveRequestStatus.APPROVED] },
    },
    data: {
      status: HrLeaveRequestStatus.CANCELLED,
      cancelledAt: new Date(),
      reviewNote: "Cleared during annual leave reset to 22 days",
      reviewedAt: new Date(),
      reviewedByUserId: ctx.session.user.id,
      reviewedByLabel: ctx.session.user.name || ctx.session.user.email || "HR",
    },
  });

  await writeAuditLog({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.session.user.id,
    actorLabel: ctx.session.user.name || ctx.session.user.email,
    module: "HR",
    entityType: "LEAVE_TYPE",
    entityId: annualType.id,
    action: "RESET",
    summary: `Reset annual leave to 22 working days for ${year}; cleared ${cleared.count} request(s) and adjustments.`,
  });
  revalidateLeave(tenantSlug);
  return { ok: true, clearedRequests: cleared.count };
}

export async function getEmployeeLeaveDetail(
  tenantSlug: string,
  employeeProfileId: string,
  year?: number,
): Promise<
  | {
      ok: true;
      employee: { id: string; name: string; department: string; gender: string };
      year: number;
      balances: Array<{
        leaveTypeId: string;
        name: string;
        dayUnit: string;
        statutoryReference: string;
        accrued: number | null;
        carried: number;
        adjustment: number;
        approved: number;
        pending: number;
        available: number | null;
        unlimited: boolean;
      }>;
      history: Array<{
        id: string;
        leaveTypeName: string;
        dayUnit: string;
        startDate: string;
        endDate: string;
        requestedUnits: number;
        reason: string;
        status: string;
        reviewedByLabel: string;
        reviewNote: string;
        createdAt: string;
      }>;
    }
  | { ok: false; error: string }
> {
  const ctx = await leaveContext(tenantSlug);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!canManageHr(Boolean(ctx.session.user.isPlatformAdmin), ctx.membership)) {
    return { ok: false, error: "You do not have permission to view leave balances." };
  }
  const profile = await prisma.employeeProfile.findFirst({
    where: { id: employeeProfileId, tenantId: ctx.tenant.id },
    select: {
      id: true,
      fullName: true,
      department: true,
      payrollCountryCode: true,
      dateOfJoining: true,
      gender: true,
    },
  });
  if (!profile) return { ok: false, error: "Employee not found." };

  const targetYear = year && year >= 2020 && year <= 2100 ? year : new Date().getUTCFullYear();
  const countryCode =
    profile.payrollCountryCode || ctx.tenant.settings?.payrollCountryCode || "NG";
  const dateFmt = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  const [summaries, historyRows] = await Promise.all([
    loadLeaveBalanceSummaries({
      tenantId: ctx.tenant.id,
      employeeProfileId: profile.id,
      payrollCountryCode: countryCode,
      department: profile.department,
      dateOfJoining: profile.dateOfJoining,
      gender: profile.gender,
      year: targetYear,
    }),
    prisma.hrLeaveRequest.findMany({
      where: {
        tenantId: ctx.tenant.id,
        employeeProfileId: profile.id,
        startDate: {
          gte: new Date(Date.UTC(targetYear, 0, 1)),
          lt: new Date(Date.UTC(targetYear + 1, 0, 1)),
        },
      },
      include: { leaveType: { select: { name: true, dayUnit: true } } },
      orderBy: { startDate: "desc" },
      take: 100,
    }),
  ]);

  return {
    ok: true,
    employee: {
      id: profile.id,
      name: profile.fullName || "Employee",
      department: profile.department || "",
      gender: profile.gender || "",
    },
    year: targetYear,
    balances: summaries.map((balance) => ({
      leaveTypeId: balance.leaveType.id,
      name: balance.leaveType.name,
      dayUnit: balance.leaveType.dayUnit,
      statutoryReference: balance.leaveType.statutoryReference || "",
      accrued: Number.isFinite(balance.accrued) ? balance.accrued : null,
      carried: balance.carried,
      adjustment: balance.adjustment,
      approved: balance.approved,
      pending: balance.pending,
      available: Number.isFinite(balance.available) ? balance.available : null,
      unlimited: balance.leaveType.unlimited,
    })),
    history: historyRows.map((request) => ({
      id: request.id,
      leaveTypeName: request.leaveType.name,
      dayUnit: request.leaveType.dayUnit,
      startDate: dateFmt.format(request.startDate),
      endDate: dateFmt.format(request.endDate),
      requestedUnits: Number(request.requestedUnits),
      reason: request.reason || "",
      status: request.status,
      reviewedByLabel: request.reviewedByLabel || "",
      reviewNote: request.reviewNote || "",
      createdAt: dateFmt.format(request.createdAt),
    })),
  };
}

export async function saveLeaveHoliday(
  tenantSlug: string,
  input: { date: string; name: string; countryCode?: string; regionCode?: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await leaveContext(tenantSlug);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!canManageHr(Boolean(ctx.session.user.isPlatformAdmin), ctx.membership)) {
    return { ok: false, error: "You do not have permission to configure holidays." };
  }
  const parsed = z
    .object({
      date: z.string(),
      name: z.string().trim().min(2).max(120),
      countryCode: z.string().trim().toUpperCase().length(2).optional().or(z.literal("")),
      regionCode: z.string().trim().max(30).optional().or(z.literal("")),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid holiday." };
  let date: Date;
  try {
    date = parseLeaveDate(parsed.data.date);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid holiday date." };
  }
  const countryCode = parsed.data.countryCode || null;
  const regionCode = parsed.data.regionCode || null;
  const duplicate = await prisma.hrHoliday.findFirst({
    where: { tenantId: ctx.tenant.id, date, countryCode, regionCode },
    select: { id: true },
  });
  if (duplicate) return { ok: false, error: "A holiday already exists for that date and location." };
  const holiday = await prisma.hrHoliday.create({
    data: {
      tenantId: ctx.tenant.id,
      date,
      name: parsed.data.name,
      countryCode,
      regionCode,
    },
  });
  await writeAuditLog({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.session.user.id,
    actorLabel: ctx.session.user.name || ctx.session.user.email,
    module: "HR",
    entityType: "LEAVE_HOLIDAY",
    entityId: holiday.id,
    action: "CREATE",
    summary: `Added ${holiday.name} to the leave calendar.`,
  });
  revalidateLeave(tenantSlug);
  return { ok: true };
}

export async function deleteLeaveHoliday(
  tenantSlug: string,
  holidayId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await leaveContext(tenantSlug);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!canManageHr(Boolean(ctx.session.user.isPlatformAdmin), ctx.membership)) {
    return { ok: false, error: "You do not have permission to configure holidays." };
  }
  const holiday = await prisma.hrHoliday.findFirst({
    where: { id: holidayId, tenantId: ctx.tenant.id },
  });
  if (!holiday) return { ok: false, error: "Holiday not found." };
  await prisma.hrHoliday.delete({ where: { id: holiday.id } });
  await writeAuditLog({
    tenantId: ctx.tenant.id,
    actorUserId: ctx.session.user.id,
    actorLabel: ctx.session.user.name || ctx.session.user.email,
    module: "HR",
    entityType: "LEAVE_HOLIDAY",
    entityId: holiday.id,
    action: "DELETE",
    summary: `Removed ${holiday.name} from the leave calendar.`,
  });
  revalidateLeave(tenantSlug);
  return { ok: true };
}

export async function syncLeavePublicHolidays(
  tenantSlug: string,
): Promise<{ ok: true; upserted: number } | { ok: false; error: string }> {
  const ctx = await leaveContext(tenantSlug);
  if (!ctx.ok) return { ok: false, error: ctx.error };
  if (!canManageHr(Boolean(ctx.session.user.isPlatformAdmin), ctx.membership)) {
    return { ok: false, error: "You do not have permission to configure holidays." };
  }
  const countryCode = ctx.tenant.settings?.payrollCountryCode || "NG";
  const result = await syncPublicHolidaysForTenant({
    tenantId: ctx.tenant.id,
    countryCode,
  });
  if (!result.ok) return { ok: false, error: result.error };
  revalidateLeave(tenantSlug);
  return { ok: true, upserted: result.upserted };
}
