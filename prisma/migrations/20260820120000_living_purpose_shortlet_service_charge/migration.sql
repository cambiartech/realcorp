-- AlterEnum
ALTER TYPE "UnitPurpose" ADD VALUE IF NOT EXISTS 'LIVING';

-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "shortletServiceCharge" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "ShortletUnit" ADD COLUMN IF NOT EXISTS "serviceCharge" DECIMAL(18,2);
