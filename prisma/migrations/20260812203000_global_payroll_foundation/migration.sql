ALTER TABLE "TenantSettings"
ADD COLUMN "payrollCountryCode" TEXT NOT NULL DEFAULT 'NG',
ADD COLUMN "payrollSettings" JSONB;

ALTER TABLE "EmployeeProfile"
ADD COLUMN "payrollCountryCode" TEXT NOT NULL DEFAULT 'NG',
ADD COLUMN "payrollRegionCode" TEXT,
ADD COLUMN "taxId" TEXT,
ADD COLUMN "taxOverrideReason" TEXT,
ADD COLUMN "pensionEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "employeePensionRate" DECIMAL(5,2) NOT NULL DEFAULT 8,
ADD COLUMN "employerPensionRate" DECIMAL(5,2) NOT NULL DEFAULT 10,
ADD COLUMN "nhfMonthly" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN "nhiaMonthly" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN "annualRent" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN "annualLifeInsurance" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN "annualMortgageInterest" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN "otherPreTaxMonthly" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN "otherPostTaxMonthly" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN "payrollSettings" JSONB;

ALTER TABLE "HrPayslipRun"
ADD COLUMN "generatedAt" TIMESTAMP(3),
ADD COLUMN "generatedByUserId" TEXT,
ADD COLUMN "generatedByLabel" TEXT,
ADD COLUMN "finalizedAt" TIMESTAMP(3),
ADD COLUMN "finalizedByUserId" TEXT,
ADD COLUMN "finalizedByLabel" TEXT;

ALTER TABLE "HrPayslip"
ADD COLUMN "jurisdictionCode" TEXT NOT NULL DEFAULT 'NG',
ADD COLUMN "taxRuleVersion" TEXT,
ADD COLUMN "chargeableIncome" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN "employerCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN "employerContributions" JSONB,
ADD COLUMN "calculationBreakdown" JSONB,
ADD COLUMN "taxOverrideApplied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "taxOverrideReason" TEXT;

CREATE INDEX "EmployeeProfile_tenantId_payrollCountryCode_idx"
ON "EmployeeProfile"("tenantId", "payrollCountryCode");

CREATE INDEX "HrPayslip_tenantId_jurisdictionCode_idx"
ON "HrPayslip"("tenantId", "jurisdictionCode");
