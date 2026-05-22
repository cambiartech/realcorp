-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('NOTE', 'CALL', 'EMAIL', 'WHATSAPP', 'MEETING', 'TASK');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('DONE', 'PENDING', 'OVERDUE');

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "status" "ActivityStatus" NOT NULL DEFAULT 'DONE',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Activity_tenantId_entityType_entityId_idx" ON "Activity"("tenantId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "Activity_tenantId_assignedUserId_idx" ON "Activity"("tenantId", "assignedUserId");

-- CreateIndex
CREATE INDEX "Activity_tenantId_dueAt_idx" ON "Activity"("tenantId", "dueAt");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
