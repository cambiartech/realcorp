ALTER TABLE "HrDocument"
ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "deletedByUserId" TEXT,
ADD COLUMN "deletedByLabel" TEXT;

CREATE INDEX "HrDocument_tenantId_deletedAt_idx" ON "HrDocument"("tenantId", "deletedAt");
