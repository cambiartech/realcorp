ALTER TYPE "BankMatchStatus" ADD VALUE IF NOT EXISTS 'EXCEPTION';

ALTER TABLE "BankStatementImport"
ADD COLUMN "finalizedAt" TIMESTAMP(3),
ADD COLUMN "finalizedByUserId" TEXT,
ADD COLUMN "finalizedByLabel" TEXT;

ALTER TABLE "BankStatementRow"
ADD COLUMN "reconciliationNote" TEXT;
