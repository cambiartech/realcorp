-- CreateEnum
CREATE TYPE "VendorBillRecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "VendorBill" ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recurrenceFrequency" "VendorBillRecurrenceFrequency",
ADD COLUMN     "recurrenceSeriesId" TEXT,
ADD COLUMN     "recurrenceIndex" INTEGER;

-- CreateIndex
CREATE INDEX "VendorBill_tenantId_recurrenceSeriesId_idx" ON "VendorBill"("tenantId", "recurrenceSeriesId");
