import { HrLeaveWorkspace } from "@/components/hr/hr-leave-workspace";
import { PaginationControl } from "@/components/pagination";
import { EmployeeProfileStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import { canManageHr, canViewHrModule } from "@/lib/hr-access";
import {
  ensureDefaultLeaveTypes,
  loadLeaveBalanceSummaries,
} from "@/lib/hr-leave-server";
import { redirectToLogin } from "@/lib/login-redirect";
import { paginate, parsePage } from "@/lib/pagination";
import { normalizeSettingsNavSlice } from "@/lib/tenant-nav-access";
import { loadTenantRequest } from "@/lib/tenant-request";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function dateLabel(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function requestRow(request: {
  id: string;
  startDate: Date;
  endDate: Date;
  requestedUnits: unknown;
  reason: string | null;
  attachmentUrl: string | null;
  status: string;
  reviewedByLabel: string | null;
  reviewNote: string | null;
  createdAt: Date;
  profile: { fullName: string | null; department: string | null };
  leaveType: { name: string; dayUnit: string };
}) {
  return {
    id: request.id,
    employeeName: request.profile.fullName || "Employee",
    department: request.profile.department || "",
    leaveTypeName: request.leaveType.name,
    dayUnit: request.leaveType.dayUnit,
    startDate: dateLabel(request.startDate),
    endDate: dateLabel(request.endDate),
    requestedUnits: Number(request.requestedUnits),
    reason: request.reason || "",
    attachmentUrl: request.attachmentUrl || "",
    status: request.status,
    reviewedByLabel: request.reviewedByLabel || "",
    reviewNote: request.reviewNote || "",
    createdAt: dateLabel(request.createdAt),
  };
}

function LeaveTrackerUnavailable() {
  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
        People operations
      </p>
      <h1 className="mt-1 text-2xl font-bold text-foreground">Leave tracker</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        This page could not load. If a database update just ran, wait a minute and
        try again. The rest of HR is still available from the sidebar.
      </p>
    </div>
  );
}

export default async function HrLeavePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantSlug } = await params;
  const sp = await searchParams;
  const { session, tenant, membership } = await loadTenantRequest(tenantSlug);
  if (!session?.user?.id) {
    await redirectToLogin(`/${tenantSlug}/hr/leave`);
  }
  if (!tenant) notFound();

  const nav = normalizeSettingsNavSlice(tenant.settings);
  if (!canViewHrModule(Boolean(session.user.isPlatformAdmin), membership, nav.moduleHr)) {
    redirect(`/${tenantSlug}`);
  }

  const canManage = canManageHr(Boolean(session.user.isPlatformAdmin), membership);
  if (!canManage) {
    redirect(`/${tenantSlug}/hr/dashboard?view=leave`);
  }
  const countryCode = tenant.settings?.payrollCountryCode || "NG";

  try {
    await ensureDefaultLeaveTypes(tenant.id, countryCode);
    const profile = await prisma.employeeProfile.findUnique({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: session.user.id,
        },
      },
    });
    const year = new Date().getUTCFullYear();
    const balances = profile
      ? await loadLeaveBalanceSummaries({
          tenantId: tenant.id,
          employeeProfileId: profile.id,
          payrollCountryCode: profile.payrollCountryCode || countryCode,
          department: profile.department,
          dateOfJoining: profile.dateOfJoining,
          year,
        })
      : [];

    const requestedPage = parsePage(sp.leavePage);
    const teamWhere = { tenantId: tenant.id };
    const teamTotal = canManage ? await prisma.hrLeaveRequest.count({ where: teamWhere }) : 0;
    const pagination = paginate(teamTotal, requestedPage, 25);
    const [myRequestRows, teamRequestRows, policies, employees, pendingTeamCount, holidays] =
      await Promise.all([
        profile
          ? prisma.hrLeaveRequest.findMany({
              where: { tenantId: tenant.id, employeeProfileId: profile.id },
              include: {
                profile: { select: { fullName: true, department: true } },
                leaveType: { select: { name: true, dayUnit: true } },
              },
              orderBy: { createdAt: "desc" },
              take: 100,
            })
          : Promise.resolve([]),
        canManage
          ? prisma.hrLeaveRequest.findMany({
              where: teamWhere,
              include: {
                profile: { select: { fullName: true, department: true } },
                leaveType: { select: { name: true, dayUnit: true } },
              },
              orderBy: [{ status: "asc" }, { createdAt: "desc" }],
              skip: pagination.skip,
              take: pagination.pageSize,
            })
          : Promise.resolve([]),
        prisma.hrLeaveType.findMany({
          where: { tenantId: tenant.id, isActive: true },
          orderBy: [{ countryCode: "asc" }, { name: "asc" }],
        }),
        canManage
          ? prisma.employeeProfile.findMany({
              where: { tenantId: tenant.id, status: EmployeeProfileStatus.ACTIVE },
              select: { id: true, fullName: true },
              orderBy: { fullName: "asc" },
              take: 500,
            })
          : Promise.resolve([]),
        canManage
          ? prisma.hrLeaveRequest.count({
              where: { tenantId: tenant.id, status: "PENDING" },
            })
          : Promise.resolve(0),
        canManage
          ? prisma.hrHoliday.findMany({
              where: {
                tenantId: tenant.id,
                date: {
                  gte: new Date(Date.UTC(year, 0, 1)),
                  lt: new Date(Date.UTC(year + 1, 0, 1)),
                },
              },
              orderBy: { date: "asc" },
            })
          : Promise.resolve([]),
      ]);

    return (
      <div className="space-y-4">
        <HrLeaveWorkspace
          tenantSlug={tenantSlug}
          canManage={canManage}
          hasEmployeeProfile={Boolean(profile)}
          year={year}
          balances={balances.map((balance) => ({
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
          }))}
          myRequests={myRequestRows.map(requestRow)}
          teamRequests={teamRequestRows.map(requestRow)}
          policies={policies.map((policy) => ({
            id: policy.id,
            name: policy.name,
            code: policy.code,
            countryCode: policy.countryCode || "",
            department: policy.department || "",
            dayUnit: policy.dayUnit,
            accrualMethod: policy.accrualMethod,
            annualEntitlement: Number(policy.annualEntitlement),
            paidPercentage: Number(policy.paidPercentage),
            minimumServiceMonths: policy.minimumServiceMonths,
            carryoverEnabled: policy.carryoverEnabled,
            maxCarryoverUnits: Number(policy.maxCarryoverUnits),
            allowNegativeBalance: policy.allowNegativeBalance,
            unlimited: policy.unlimited,
            requiresDocumentAfterUnits:
              policy.requiresDocumentAfterUnits == null ? "" : String(Number(policy.requiresDocumentAfterUnits)),
            statutoryReference: policy.statutoryReference || "",
          }))}
          holidays={holidays.map((holiday) => ({
            id: holiday.id,
            name: holiday.name,
            date: dateLabel(holiday.date),
            countryCode: holiday.countryCode || "",
            regionCode: holiday.regionCode || "",
          }))}
          employeeOptions={employees.map((employee) => ({
            id: employee.id,
            name: employee.fullName || "Employee",
          }))}
          pendingTeamCount={pendingTeamCount}
        />
        {canManage && pagination.totalPages > 1 ? (
          <div className="overflow-hidden rounded-lg border border-foreground/10">
            <PaginationControl
              pathname={`/${tenantSlug}/hr/leave`}
              searchParams={sp}
              pageParam="leavePage"
              page={pagination.page}
              pageSize={pagination.pageSize}
              total={pagination.total}
              totalPages={pagination.totalPages}
              itemLabel="leave requests"
            />
          </div>
        ) : null}
      </div>
    );
  } catch (error) {
    console.error("[hr-leave]", error);
    return <LeaveTrackerUnavailable />;
  }
}
