-- CreateEnum
CREATE TYPE "WorkTaskRecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "WorkTask" ADD COLUMN     "recurrenceFrequency" "WorkTaskRecurrenceFrequency",
ADD COLUMN     "recurrenceSeriesId" TEXT,
ADD COLUMN     "recurrenceIndex" INTEGER,
ADD COLUMN     "recurrenceEndsAt" TIMESTAMP(3),
ADD COLUMN     "recurrenceMaxOccurrences" INTEGER,
ADD COLUMN     "recurrenceActive" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "WorkTask_tenantId_recurrenceSeriesId_idx" ON "WorkTask"("tenantId", "recurrenceSeriesId");
