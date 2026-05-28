-- Tasks module: teamspaces, work projects, org-wide tasks

CREATE TYPE "WorkTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED');
CREATE TYPE "WorkTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "TaskProjectStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

ALTER TABLE "TenantSettings" ADD COLUMN "moduleTasks" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "TaskSpace" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT DEFAULT '#6366f1',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskSpace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TaskProject" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "sprintLabel" TEXT,
    "iconEmoji" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "spaceId" TEXT,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "WorkTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "assigneeUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "sprintLabel" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "linkedEntityType" TEXT,
    "linkedEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskSpace_tenantId_slug_key" ON "TaskSpace"("tenantId", "slug");
CREATE INDEX "TaskSpace_tenantId_sortOrder_idx" ON "TaskSpace"("tenantId", "sortOrder");

CREATE INDEX "TaskProject_tenantId_spaceId_idx" ON "TaskProject"("tenantId", "spaceId");
CREATE INDEX "TaskProject_tenantId_status_idx" ON "TaskProject"("tenantId", "status");

CREATE INDEX "WorkTask_tenantId_status_idx" ON "WorkTask"("tenantId", "status");
CREATE INDEX "WorkTask_tenantId_assigneeUserId_idx" ON "WorkTask"("tenantId", "assigneeUserId");
CREATE INDEX "WorkTask_tenantId_spaceId_idx" ON "WorkTask"("tenantId", "spaceId");
CREATE INDEX "WorkTask_tenantId_projectId_idx" ON "WorkTask"("tenantId", "projectId");
CREATE INDEX "WorkTask_tenantId_linkedEntityType_linkedEntityId_idx" ON "WorkTask"("tenantId", "linkedEntityType", "linkedEntityId");

ALTER TABLE "TaskSpace" ADD CONSTRAINT "TaskSpace_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskProject" ADD CONSTRAINT "TaskProject_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskProject" ADD CONSTRAINT "TaskProject_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "TaskSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "TaskSpace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkTask" ADD CONSTRAINT "WorkTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "TaskProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
