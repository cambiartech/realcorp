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
            annualEntitlement: 84,
            paidPercentage: 100,
            minimumServiceMonths: 0,
            statutoryReference:
              "Organization policy: 12 weeks (84 calendar days) at full pay (Labour Act s.54 floor is 12 weeks at 50%)",
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
  // One-time: earlier seed used 90 days; org policy is 12 weeks (84) at full pay.
  // After this, each tenant edits their own rules under Leave policies — we do not overwrite custom values.
  const maternityFloor = existing.find((row) => row.code === "MATERNITY-NG");
  if (maternityFloor && Number(maternityFloor.annualEntitlement) === 90) {
    await prisma.hrLeaveType.update({
      where: { id: maternityFloor.id },
      data: {
        annualEntitlement: 84,
        paidPercentage: 100,
        minimumServiceMonths: 0,
        dayUnit: "CALENDAR_DAYS",
        statutoryReference:
          "Organization policy: 12 weeks (84 calendar days) at full pay (Labour Act s.54 floor is 12 weeks at 50%)",
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

/** Roster of every active employee with leave remaining for the year (HR leave balances table). */
export async function loadLeaveEmployeeRoster(input: {
  tenantId: string;
  payrollCountryCode: string;
  year: number;
  asOf?: Date;
}) {
  const asOf = input.asOf ?? new Date();
  const startOfYear = new Date(Date.UTC(input.year, 0, 1));
  const endOfYear = new Date(Date.UTC(input.year + 1, 0, 1));

  const [employees, leaveTypes] = await Promise.all([
    prisma.employeeProfile.findMany({
      where: { tenantId: input.tenantId, status: "ACTIVE" },
      select: {
        id: true,
        fullName: true,
        department: true,
        payrollCountryCode: true,
        dateOfJoining: true,
      },
      orderBy: { fullName: "asc" },
      take: 500,
    }),
    prisma.hrLeaveType.findMany({
      where: {
        tenantId: input.tenantId,
        isActive: true,
        OR: [{ countryCode: null }, { countryCode: input.payrollCountryCode }],
      },
      orderBy: [{ countryCode: "desc" }, { name: "asc" }],
    }),
  ]);

  if (!employees.length || !leaveTypes.length) {
    return { leaveTypes, rows: [] as Array<{
      employeeProfileId: string;
      name: string;
      department: string;
      balances: Array<{
        leaveTypeId: string;
        name: string;
        dayUnit: string;
        available: number | null;
        unlimited: boolean;
        adjustment: number;
        approved: number;
        pending: number;
      }>;
      requestCount: number;
    }> };
  }

  const employeeIds = employees.map((e) => e.id);
  const typeIds = leaveTypes.map((t) => t.id);

  const [requests, balances] = await Promise.all([
    prisma.hrLeaveRequest.findMany({
      where: {
        tenantId: input.tenantId,
        employeeProfileId: { in: employeeIds },
        leaveTypeId: { in: typeIds },
        startDate: { gte: startOfYear, lt: endOfYear },
        status: { in: [HrLeaveRequestStatus.PENDING, HrLeaveRequestStatus.APPROVED] },
      },
      select: {
        employeeProfileId: true,
        leaveTypeId: true,
        status: true,
        requestedUnits: true,
      },
    }),
    prisma.hrLeaveBalance.findMany({
      where: {
        tenantId: input.tenantId,
        employeeProfileId: { in: employeeIds },
        leaveTypeId: { in: typeIds },
        year: input.year,
      },
    }),
  ]);

  const requestCountByEmployee = new Map<string, number>();
  for (const request of requests) {
    requestCountByEmployee.set(
      request.employeeProfileId,
      (requestCountByEmployee.get(request.employeeProfileId) || 0) + 1,
    );
  }

  const rows = employees.map((employee) => {
    const country = employee.payrollCountryCode || input.payrollCountryCode;
    const applicableTypes = leaveTypes.filter(
      (type) => !type.countryCode || type.countryCode === country,
    );
    const balancesForEmployee = applicableTypes.map((type) => {
      const approved = requests
        .filter(
          (r) =>
            r.employeeProfileId === employee.id &&
            r.leaveTypeId === type.id &&
            r.status === HrLeaveRequestStatus.APPROVED,
        )
        .reduce((sum, r) => sum + Number(r.requestedUnits), 0);
      const pending = requests
        .filter(
          (r) =>
            r.employeeProfileId === employee.id &&
            r.leaveTypeId === type.id &&
            r.status === HrLeaveRequestStatus.PENDING,
        )
        .reduce((sum, r) => sum + Number(r.requestedUnits), 0);
      const balance = balances.find(
        (b) => b.employeeProfileId === employee.id && b.leaveTypeId === type.id,
      );
      const accrued = accruedLeaveEntitlement({
        policy: {
          annualEntitlement: Number(type.annualEntitlement),
          accrualMethod: type.accrualMethod as LeaveAccrualMethod,
          minimumServiceMonths: type.minimumServiceMonths,
          unlimited: type.unlimited,
        },
        dateOfJoining: employee.dateOfJoining,
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
        leaveTypeId: type.id,
        name: type.name,
        dayUnit: type.dayUnit,
        available: Number.isFinite(available) ? available : null,
        unlimited: type.unlimited,
        adjustment: Number(balance?.adjustmentUnits ?? 0),
        approved,
        pending,
      };
    });

    return {
      employeeProfileId: employee.id,
      name: employee.fullName || "Employee",
      department: employee.department || "",
      balances: balancesForEmployee,
      requestCount: requestCountByEmployee.get(employee.id) || 0,
    };
  });

  return { leaveTypes, rows };
}
