-- AlterTable: add score and lastActivityAt to Lead
ALTER TABLE "Lead" ADD COLUMN "score" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Lead" ADD COLUMN "lastActivityAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Lead_tenantId_score_idx" ON "Lead"("tenantId", "score");
