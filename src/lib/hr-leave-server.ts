import "server-only";

import { HrLeaveRequestStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import {
  accruedLeaveEntitlement,
  availableLeaveUnits,
  type LeaveAccrualMethod,
} from "@/lib/hr-leave";

export async function ensureDefaultLeaveTypes(tenantId: string, countryCode: string) {
  const country = countryCode.trim().toUpperCase() || "NG";
  const existing = await prisma.hrLeaveType.findMany({
    where: { tenantId },
    select: { id: true, code: true, annualEntitlement: true, minimumServiceMonths: true, paidPercentage: true },
  });
  const codes = new Set(existing.map((item) => item.code));
  const defaults = [
    {
      code: "UNPAID-GLOBAL",
      name: "Unpaid leave",
      countryCode: null,
      dayUnit: "WORKING_DAYS" as const,
      accrualMethod: "NONE" as const,
      annualEntitlement: 0,
      paidPercentage: 0,
      unlimited: true,
      statutoryReference: "Organization policy",
    },
    ...(country === "NG"
      ? [
          {
            code: "ANNUAL-NG",
            name: "Annual leave",
            countryCode: "NG",
            dayUnit: "WORKING_DAYS" as const,
            accrualMethod: "ANNUAL_GRANT" as const,
            annualEntitlement: 22,
            paidPercentage: 100,
            minimumServiceMonths: 0,
            carryoverEnabled: true,
            maxCarryoverUnits: 6,
            statutoryReference: "Organization policy (Labour Act s.18 floor is 6 working days after 12 months)",
          },
          {
            code: "SICK-NG",
            name: "Certified sick leave",
            countryCode: "NG",
            dayUnit: "WORKING_DAYS" as const,
            accrualMethod: "ANNUAL_GRANT" as const,
            annualEntitlement: 12,
            paidPercentage: 100,
            requiresDocumentAfterUnits: 0,
            statutoryReference: "Nigeria Labour Act, section 16",
          },
          {
            code: "MATERNITY-NG",
            name: "Maternity leave",
            countryCode: "NG",
            dayUnit: "CALENDAR_DAYS" as const,
            accrualMethod: "ANNUAL_GRANT" as const,
            annualEntitlement: 90,
            paidPercentage: 100,
            minimumServiceMonths: 0,
            statutoryReference: "Organization policy (Labour Act s.54 floor is 12 weeks at 50% pay)",
          },
        ]
      : []),
  ];
  const missing = defaults.filter((item) => !codes.has(item.code));
  if (missing.length) {
    try {
      await prisma.hrLeaveType.createMany({
        data: missing.map((item) => ({ tenantId, ...item })),
        skipDuplicates: true,
      });
    } catch {
      for (const item of missing) {
        const found = await prisma.hrLeaveType.findFirst({
          where: { tenantId, code: item.code },
          select: { id: true },
        });
        if (!found) {
          await prisma.hrLeaveType.create({ data: { tenantId, ...item } });
        }
      }
    }
  }

  const now = new Date();
  const annualFloor = existing.find((row) => row.code === "ANNUAL-NG");
  if (annualFloor && Number(annualFloor.annualEntitlement) === 6 && annualFloor.minimumServiceMonths === 12) {
    await prisma.hrLeaveType.update({
      where: { id: annualFloor.id },
      data: {
        annualEntitlement: 22,
        minimumServiceMonths: 0,
        statutoryReference: "Organization policy (Labour Act s.18 floor is 6 working days after 12 months)",
        lastReviewedAt: now,
      },
    });
  }
  const maternityFloor = existing.find((row) => row.code === "MATERNITY-NG");
  if (maternityFloor && Number(maternityFloor.annualEntitlement) === 84) {
    await prisma.hrLeaveType.update({
      where: { id: maternityFloor.id },
      data: {
        annualEntitlement: 90,
        paidPercentage: 100,
        minimumServiceMonths: 0,
        statutoryReference: "Organization policy (Labour Act s.54 floor is 12 weeks at 50% pay)",
        lastReviewedAt: now,
      },
    });
  }
}

export async function loadLeaveBalanceSummaries(input: {
  tenantId: string;
  employeeProfileId: string;
  payrollCountryCode: string;
  department?: string | null;
  dateOfJoining?: Date | null;
  year: number;
  asOf?: Date;
}) {
  const asOf = input.asOf ?? new Date();
  const startOfYear = new Date(Date.UTC(input.year, 0, 1));
  const endOfYear = new Date(Date.UTC(input.year + 1, 0, 1));
  const leaveTypes = await prisma.hrLeaveType.findMany({
    where: {
      tenantId: input.tenantId,
      isActive: true,
      AND: [
        { OR: [{ countryCode: null }, { countryCode: input.payrollCountryCode }] },
        input.department
          ? { OR: [{ department: null }, { department: input.department }] }
          : { department: null },
      ],
    },
    orderBy: [{ countryCode: "desc" }, { name: "asc" }],
  });
  const [requests, balances] = await Promise.all([
    prisma.hrLeaveRequest.findMany({
      where: {
        tenantId: input.tenantId,
        employeeProfileId: input.employeeProfileId,
        leaveTypeId: { in: leaveTypes.map((type) => type.id) },
        startDate: { gte: startOfYear, lt: endOfYear },
        status: { in: [HrLeaveRequestStatus.PENDING, HrLeaveRequestStatus.APPROVED] },
      },
      select: { leaveTypeId: true, status: true, requestedUnits: true },
    }),
    prisma.hrLeaveBalance.findMany({
      where: {
        tenantId: input.tenantId,
        employeeProfileId: input.employeeProfileId,
        leaveTypeId: { in: leaveTypes.map((type) => type.id) },
        year: input.year,
      },
    }),
  ]);

  return leaveTypes.map((type) => {
    const approved = requests
      .filter(
        (request) =>
          request.leaveTypeId === type.id && request.status === HrLeaveRequestStatus.APPROVED,
      )
      .reduce((sum, request) => sum + Number(request.requestedUnits), 0);
    const pending = requests
      .filter(
        (request) =>
          request.leaveTypeId === type.id && request.status === HrLeaveRequestStatus.PENDING,
      )
      .reduce((sum, request) => sum + Number(request.requestedUnits), 0);
    const balance = balances.find((item) => item.leaveTypeId === type.id);
    const accrued = accruedLeaveEntitlement({
      policy: {
        annualEntitlement: Number(type.annualEntitlement),
        accrualMethod: type.accrualMethod as LeaveAccrualMethod,
        minimumServiceMonths: type.minimumServiceMonths,
        unlimited: type.unlimited,
      },
      dateOfJoining: input.dateOfJoining,
      asOf,
      year: input.year,
    });
    const available = availableLeaveUnits({
      accrued,
      carried: Number(balance?.carriedUnits ?? 0),
      adjustment: Number(balance?.adjustmentUnits ?? 0),
      approved,
      pending,
      unlimited: type.unlimited,
    });
    return {
      leaveType: type,
      year: input.year,
      accrued,
      carried: Number(balance?.carriedUnits ?? 0),
      adjustment: Number(balance?.adjustmentUnits ?? 0),
      approved,
      pending,
      available,
    };
  });
}
