-- AlterEnum
ALTER TYPE "MembershipRole" ADD VALUE 'HR_MANAGER';

-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "moduleHr" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "EmployeeProfileStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXITED');
CREATE TYPE "HrDocumentCategory" AS ENUM ('BIODATA', 'BANK_FORM', 'OFFER_LETTER', 'NDA', 'GUARANTOR', 'JOB_DESCRIPTION', 'CONTRACT', 'PAYSLIP', 'APPRAISAL', 'OTHER');
CREATE TYPE "HrAppraisalCycleType" AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE "HrAppraisalCycleStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "HrAppraisalStatus" AS ENUM ('DRAFT', 'SELF_SUBMITTED', 'REVIEWED');
CREATE TYPE "HrPayslipRunStatus" AS ENUM ('DRAFT', 'FINALIZED');

-- CreateTable
CREATE TABLE "EmployeeProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeNumber" TEXT,
    "status" "EmployeeProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "fullName" TEXT,
    "gender" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "maritalStatus" TEXT,
    "nationality" TEXT,
    "phoneMobile" TEXT,
    "workEmail" TEXT,
    "addressStreet" TEXT,
    "addressCity" TEXT,
    "addressState" TEXT,
    "position" TEXT,
    "department" TEXT,
    "dateOfJoining" TIMESTAMP(3),
    "reportingToLabel" TEXT,
    "employmentType" TEXT,
    "workSchedule" TEXT,
    "paygroupName" TEXT,
    "grossMonthly" DECIMAL(18,2),
    "basicPercent" DECIMAL(5,2) NOT NULL DEFAULT 30,
    "housingPercent" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "transportPercent" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "otherPercent" DECIMAL(5,2) NOT NULL DEFAULT 35,
    "emergencyContact" JSONB,
    "education" JSONB,
    "nextOfKin" JSONB,
    "healthInfo" JSONB,
    "additionalInfo" JSONB,
    "bankAccount" JSONB,
    "guarantorInfo" JSONB,
    "hrNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeProfileId" TEXT NOT NULL,
    "category" "HrDocumentCategory" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "uploadedByUserId" TEXT,
    "uploadedByLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrAppraisalAction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cycleType" "HrAppraisalCycleType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrAppraisalAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrAppraisalCycle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cycleType" "HrAppraisalCycleType" NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "status" "HrAppraisalCycleStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrAppraisalCycle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrAppraisal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeProfileId" TEXT NOT NULL,
    "status" "HrAppraisalStatus" NOT NULL DEFAULT 'DRAFT',
    "actionScores" JSONB,
    "selfNotes" TEXT,
    "managerNotes" TEXT,
    "overallRating" INTEGER,
    "reviewerUserId" TEXT,
    "reviewerLabel" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrAppraisal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrPayslipRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "status" "HrPayslipRunStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrPayslipRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrPayslip" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "employeeProfileId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "grossPay" DECIMAL(18,2) NOT NULL,
    "payeeTax" DECIMAL(18,2) NOT NULL,
    "pensionDeduction" DECIMAL(18,2) NOT NULL,
    "otherDeductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netPay" DECIMAL(18,2) NOT NULL,
    "earningsBreakdown" JSONB NOT NULL,
    "deductionsBreakdown" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HrPayslip_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrPerformanceGoal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetValue" TEXT,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "createdByLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrPerformanceGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeProfile_tenantId_userId_key" ON "EmployeeProfile"("tenantId", "userId");
CREATE INDEX "EmployeeProfile_tenantId_status_idx" ON "EmployeeProfile"("tenantId", "status");
CREATE INDEX "EmployeeProfile_tenantId_department_idx" ON "EmployeeProfile"("tenantId", "department");

CREATE INDEX "HrDocument_tenantId_employeeProfileId_idx" ON "HrDocument"("tenantId", "employeeProfileId");
CREATE INDEX "HrDocument_tenantId_category_idx" ON "HrDocument"("tenantId", "category");

CREATE INDEX "HrAppraisalAction_tenantId_cycleType_isActive_idx" ON "HrAppraisalAction"("tenantId", "cycleType", "isActive");

CREATE UNIQUE INDEX "HrAppraisalCycle_tenantId_cycleType_periodLabel_key" ON "HrAppraisalCycle"("tenantId", "cycleType", "periodLabel");
CREATE INDEX "HrAppraisalCycle_tenantId_status_idx" ON "HrAppraisalCycle"("tenantId", "status");

CREATE UNIQUE INDEX "HrAppraisal_cycleId_employeeProfileId_key" ON "HrAppraisal"("cycleId", "employeeProfileId");
CREATE INDEX "HrAppraisal_tenantId_employeeProfileId_idx" ON "HrAppraisal"("tenantId", "employeeProfileId");

CREATE UNIQUE INDEX "HrPayslipRun_tenantId_year_month_key" ON "HrPayslipRun"("tenantId", "year", "month");
CREATE INDEX "HrPayslipRun_tenantId_status_idx" ON "HrPayslipRun"("tenantId", "status");

CREATE UNIQUE INDEX "HrPayslip_runId_employeeProfileId_key" ON "HrPayslip"("runId", "employeeProfileId");
CREATE INDEX "HrPayslip_tenantId_employeeProfileId_idx" ON "HrPayslip"("tenantId", "employeeProfileId");

CREATE INDEX "HrPerformanceGoal_tenantId_employeeProfileId_idx" ON "HrPerformanceGoal"("tenantId", "employeeProfileId");

-- AddForeignKey
ALTER TABLE "EmployeeProfile" ADD CONSTRAINT "EmployeeProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HrDocument" ADD CONSTRAINT "HrDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrDocument" ADD CONSTRAINT "HrDocument_employeeProfileId_fkey" FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HrAppraisalAction" ADD CONSTRAINT "HrAppraisalAction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HrAppraisalCycle" ADD CONSTRAINT "HrAppraisalCycle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HrAppraisal" ADD CONSTRAINT "HrAppraisal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrAppraisal" ADD CONSTRAINT "HrAppraisal_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "HrAppraisalCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrAppraisal" ADD CONSTRAINT "HrAppraisal_employeeProfileId_fkey" FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HrPayslipRun" ADD CONSTRAINT "HrPayslipRun_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HrPayslip" ADD CONSTRAINT "HrPayslip_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrPayslip" ADD CONSTRAINT "HrPayslip_runId_fkey" FOREIGN KEY ("runId") REFERENCES "HrPayslipRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrPayslip" ADD CONSTRAINT "HrPayslip_employeeProfileId_fkey" FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HrPerformanceGoal" ADD CONSTRAINT "HrPerformanceGoal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrPerformanceGoal" ADD CONSTRAINT "HrPerformanceGoal_employeeProfileId_fkey" FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
