CREATE TYPE "HrLeaveAccrualMethod" AS ENUM ('ANNUAL_GRANT', 'MONTHLY', 'NONE');
CREATE TYPE "HrLeaveDayUnit" AS ENUM ('WORKING_DAYS', 'CALENDAR_DAYS', 'HOURS');
CREATE TYPE "HrLeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "HrLeaveType" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "countryCode" TEXT,
  "department" TEXT,
  "dayUnit" "HrLeaveDayUnit" NOT NULL DEFAULT 'WORKING_DAYS',
  "accrualMethod" "HrLeaveAccrualMethod" NOT NULL DEFAULT 'ANNUAL_GRANT',
  "annualEntitlement" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "paidPercentage" DECIMAL(5,2) NOT NULL DEFAULT 100,
  "minimumServiceMonths" INTEGER NOT NULL DEFAULT 0,
  "carryoverEnabled" BOOLEAN NOT NULL DEFAULT false,
  "maxCarryoverUnits" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "allowNegativeBalance" BOOLEAN NOT NULL DEFAULT false,
  "unlimited" BOOLEAN NOT NULL DEFAULT false,
  "requiresDocumentAfterUnits" DECIMAL(8,2),
  "statutoryReference" TEXT,
  "lastReviewedAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HrLeaveType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrLeaveRequest" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeProfileId" TEXT NOT NULL,
  "leaveTypeId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "requestedUnits" DECIMAL(8,2) NOT NULL,
  "reason" TEXT,
  "attachmentUrl" TEXT,
  "status" "HrLeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
  "policySnapshot" JSONB NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewedByLabel" TEXT,
  "reviewNote" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HrLeaveRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrLeaveBalance" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeProfileId" TEXT NOT NULL,
  "leaveTypeId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "carriedUnits" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "adjustmentUnits" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "adjustmentReason" TEXT,
  "adjustedByUserId" TEXT,
  "adjustedByLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HrLeaveBalance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrHoliday" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "countryCode" TEXT,
  "regionCode" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "HrHoliday_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HrLeaveType_tenantId_code_countryCode_department_key"
ON "HrLeaveType"("tenantId", "code", "countryCode", "department");
CREATE INDEX "HrLeaveType_tenantId_isActive_countryCode_idx"
ON "HrLeaveType"("tenantId", "isActive", "countryCode");

CREATE INDEX "HrLeaveRequest_tenantId_status_startDate_idx"
ON "HrLeaveRequest"("tenantId", "status", "startDate");
CREATE INDEX "HrLeaveRequest_employeeProfileId_status_startDate_idx"
ON "HrLeaveRequest"("employeeProfileId", "status", "startDate");
CREATE INDEX "HrLeaveRequest_leaveTypeId_startDate_idx"
ON "HrLeaveRequest"("leaveTypeId", "startDate");

CREATE UNIQUE INDEX "HrLeaveBalance_employeeProfileId_leaveTypeId_year_key"
ON "HrLeaveBalance"("employeeProfileId", "leaveTypeId", "year");
CREATE INDEX "HrLeaveBalance_tenantId_year_idx" ON "HrLeaveBalance"("tenantId", "year");

CREATE UNIQUE INDEX "HrHoliday_tenantId_date_countryCode_regionCode_key"
ON "HrHoliday"("tenantId", "date", "countryCode", "regionCode");
CREATE INDEX "HrHoliday_tenantId_date_idx" ON "HrHoliday"("tenantId", "date");

ALTER TABLE "HrLeaveType"
ADD CONSTRAINT "HrLeaveType_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HrLeaveRequest"
ADD CONSTRAINT "HrLeaveRequest_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrLeaveRequest"
ADD CONSTRAINT "HrLeaveRequest_employeeProfileId_fkey"
FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrLeaveRequest"
ADD CONSTRAINT "HrLeaveRequest_leaveTypeId_fkey"
FOREIGN KEY ("leaveTypeId") REFERENCES "HrLeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HrLeaveBalance"
ADD CONSTRAINT "HrLeaveBalance_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrLeaveBalance"
ADD CONSTRAINT "HrLeaveBalance_employeeProfileId_fkey"
FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrLeaveBalance"
ADD CONSTRAINT "HrLeaveBalance_leaveTypeId_fkey"
FOREIGN KEY ("leaveTypeId") REFERENCES "HrLeaveType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HrHoliday"
ADD CONSTRAINT "HrHoliday_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
