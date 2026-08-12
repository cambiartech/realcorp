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
    select: { code: true },
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
            annualEntitlement: 6,
            paidPercentage: 100,
            minimumServiceMonths: 12,
            carryoverEnabled: true,
            maxCarryoverUnits: 6,
            statutoryReference: "Nigeria Labour Act, section 18 — statutory floor; company policy may be higher",
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
            annualEntitlement: 84,
            paidPercentage: 50,
            minimumServiceMonths: 6,
            statutoryReference: "Nigeria Labour Act, section 54 — organization may provide better terms",
          },
        ]
      : []),
  ];
  const missing = defaults.filter((item) => !codes.has(item.code));
  if (missing.length) {
    await prisma.hrLeaveType.createMany({
      data: missing.map((item) => ({ tenantId, ...item })),
      skipDuplicates: true,
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
