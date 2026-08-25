-- AlterEnum
ALTER TYPE "FinanceIncomeType" ADD VALUE IF NOT EXISTS 'SERVICE_FEE';

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN "serviceFee" DECIMAL(18,2);
