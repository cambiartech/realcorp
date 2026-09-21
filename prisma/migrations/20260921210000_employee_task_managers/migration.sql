-- Cross-department task assigners: manager may assign WorkTasks to report
CREATE TABLE "EmployeeTaskManager" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reportUserId" TEXT NOT NULL,
    "managerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,
    "createdByLabel" TEXT,

    CONSTRAINT "EmployeeTaskManager_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeeTaskManager_tenantId_reportUserId_managerUserId_key" ON "EmployeeTaskManager"("tenantId", "reportUserId", "managerUserId");
CREATE INDEX "EmployeeTaskManager_tenantId_managerUserId_idx" ON "EmployeeTaskManager"("tenantId", "managerUserId");
CREATE INDEX "EmployeeTaskManager_tenantId_reportUserId_idx" ON "EmployeeTaskManager"("tenantId", "reportUserId");

ALTER TABLE "EmployeeTaskManager" ADD CONSTRAINT "EmployeeTaskManager_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
