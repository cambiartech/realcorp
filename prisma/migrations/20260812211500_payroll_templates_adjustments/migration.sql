CREATE TYPE "HrPayrollAdjustmentType" AS ENUM ('EARNING', 'DEDUCTION');

CREATE TABLE "HrPayTemplate" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL DEFAULT 'NG',
  "basicPercent" DECIMAL(5,2) NOT NULL DEFAULT 30,
  "housingPercent" DECIMAL(5,2) NOT NULL DEFAULT 20,
  "transportPercent" DECIMAL(5,2) NOT NULL DEFAULT 15,
  "otherPercent" DECIMAL(5,2) NOT NULL DEFAULT 35,
  "pensionEnabled" BOOLEAN NOT NULL DEFAULT true,
  "employeePensionRate" DECIMAL(5,2) NOT NULL DEFAULT 8,
  "employerPensionRate" DECIMAL(5,2) NOT NULL DEFAULT 10,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HrPayTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HrPayrollAdjustment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "employeeProfileId" TEXT NOT NULL,
  "type" "HrPayrollAdjustmentType" NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "taxable" BOOLEAN NOT NULL DEFAULT true,
  "pensionable" BOOLEAN NOT NULL DEFAULT false,
  "preTax" BOOLEAN NOT NULL DEFAULT false,
  "createdByUserId" TEXT,
  "createdByLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "HrPayrollAdjustment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EmployeeProfile" ADD COLUMN "payTemplateId" TEXT;

CREATE UNIQUE INDEX "HrPayTemplate_tenantId_countryCode_name_key"
ON "HrPayTemplate"("tenantId", "countryCode", "name");

CREATE INDEX "HrPayTemplate_tenantId_countryCode_isDefault_idx"
ON "HrPayTemplate"("tenantId", "countryCode", "isDefault");

CREATE INDEX "HrPayrollAdjustment_tenantId_runId_idx"
ON "HrPayrollAdjustment"("tenantId", "runId");

CREATE INDEX "HrPayrollAdjustment_runId_employeeProfileId_idx"
ON "HrPayrollAdjustment"("runId", "employeeProfileId");

CREATE INDEX "EmployeeProfile_tenantId_payTemplateId_idx"
ON "EmployeeProfile"("tenantId", "payTemplateId");

ALTER TABLE "HrPayTemplate"
ADD CONSTRAINT "HrPayTemplate_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HrPayrollAdjustment"
ADD CONSTRAINT "HrPayrollAdjustment_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HrPayrollAdjustment"
ADD CONSTRAINT "HrPayrollAdjustment_runId_fkey"
FOREIGN KEY ("runId") REFERENCES "HrPayslipRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HrPayrollAdjustment"
ADD CONSTRAINT "HrPayrollAdjustment_employeeProfileId_fkey"
FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeProfile"
ADD CONSTRAINT "EmployeeProfile_payTemplateId_fkey"
FOREIGN KEY ("payTemplateId") REFERENCES "HrPayTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
