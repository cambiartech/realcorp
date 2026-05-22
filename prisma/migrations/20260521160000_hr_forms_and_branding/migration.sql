-- Organization branding for HR documents
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "orgEmail" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "orgPhone" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "orgAddressLine" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "orgCity" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "orgState" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "orgCountry" TEXT DEFAULT 'Nigeria';

-- Enums
CREATE TYPE "HrFormType" AS ENUM ('BIODATA', 'BANK_FORM', 'GUARANTOR', 'HEALTH');
CREATE TYPE "HrFormDeliveryMode" AS ENUM ('ONLINE_FILL', 'PRINT_UPLOAD', 'BOTH');
CREATE TYPE "HrFormRequestStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'CANCELLED', 'EXPIRED');

-- Fillable form requests (shareable links)
CREATE TABLE "HrFormRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeProfileId" TEXT NOT NULL,
    "formType" "HrFormType" NOT NULL,
    "deliveryMode" "HrFormDeliveryMode" NOT NULL DEFAULT 'ONLINE_FILL',
    "status" "HrFormRequestStatus" NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "hrNote" TEXT,
    "submittedPayload" JSONB,
    "submittedFileUrl" TEXT,
    "submittedFileName" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedByLabel" TEXT,
    "createdByUserId" TEXT,
    "createdByLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrFormRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HrFormRequest_token_key" ON "HrFormRequest"("token");
CREATE INDEX "HrFormRequest_tenantId_employeeProfileId_idx" ON "HrFormRequest"("tenantId", "employeeProfileId");
CREATE INDEX "HrFormRequest_tenantId_status_idx" ON "HrFormRequest"("tenantId", "status");
CREATE INDEX "HrFormRequest_token_idx" ON "HrFormRequest"("token");

ALTER TABLE "HrFormRequest" ADD CONSTRAINT "HrFormRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrFormRequest" ADD CONSTRAINT "HrFormRequest_employeeProfileId_fkey" FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
