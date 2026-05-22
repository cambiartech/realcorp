-- CreateEnum
CREATE TYPE "UnitPurpose" AS ENUM ('SALE', 'SHORT_LET', 'RENTAL', 'HOSTEL');

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN "purpose" "UnitPurpose" NOT NULL DEFAULT 'SALE';
