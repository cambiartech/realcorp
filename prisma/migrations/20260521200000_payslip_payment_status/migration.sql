-- CreateEnum
CREATE TYPE "HrPayslipPaymentStatus" AS ENUM ('PENDING', 'PAID');

-- AlterTable
ALTER TABLE "HrPayslip" ADD COLUMN "paymentStatus" "HrPayslipPaymentStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "HrPayslip" ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "HrPayslip" ADD COLUMN "paymentReference" TEXT;
ALTER TABLE "HrPayslip" ADD COLUMN "paidByLabel" TEXT;
ALTER TABLE "HrPayslip" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "HrPayslip_tenantId_paymentStatus_idx" ON "HrPayslip"("tenantId", "paymentStatus");
