-- AlterTable
ALTER TABLE "EmployeeProfile" ADD COLUMN "reportsToUserId" TEXT;

-- CreateIndex
CREATE INDEX "EmployeeProfile_tenantId_reportsToUserId_idx" ON "EmployeeProfile"("tenantId", "reportsToUserId");
