-- CreateTable
CREATE TABLE "WorkTaskAssignee" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkTaskAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkTaskAssignee_taskId_userId_key" ON "WorkTaskAssignee"("taskId", "userId");

-- CreateIndex
CREATE INDEX "WorkTaskAssignee_tenantId_userId_idx" ON "WorkTaskAssignee"("tenantId", "userId");

-- AddForeignKey
ALTER TABLE "WorkTaskAssignee" ADD CONSTRAINT "WorkTaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Copy the existing single assignee onto the new list.
INSERT INTO "WorkTaskAssignee" ("id", "tenantId", "taskId", "userId", "createdAt")
SELECT md5("id" || ':assignee'), "tenantId", "id", "assigneeUserId", CURRENT_TIMESTAMP
FROM "WorkTask"
WHERE "assigneeUserId" IS NOT NULL;
