ALTER TABLE "HrHoliday" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "HrHoliday" ADD COLUMN "tentative" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HrHoliday" ADD COLUMN "googleEventId" TEXT;

CREATE UNIQUE INDEX "HrHoliday_tenantId_googleEventId_key" ON "HrHoliday"("tenantId", "googleEventId");

CREATE TABLE "CelebrationSendLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "employeeProfileId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "sentOn" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CelebrationSendLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CelebrationSendLog_tenantId_employeeProfileId_kind_sentOn_key"
  ON "CelebrationSendLog"("tenantId", "employeeProfileId", "kind", "sentOn");
CREATE INDEX "CelebrationSendLog_tenantId_sentOn_idx" ON "CelebrationSendLog"("tenantId", "sentOn");

ALTER TABLE "CelebrationSendLog"
  ADD CONSTRAINT "CelebrationSendLog_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
