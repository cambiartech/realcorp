CREATE TYPE "BankMatchStatus" AS ENUM ('UNMATCHED', 'MATCHED');

CREATE TABLE "BankStatementImport" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sourceName" TEXT NOT NULL,
  "importedByUserId" TEXT,
  "importedByLabel" TEXT,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BankStatementImport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BankStatementRow" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "postedAt" TIMESTAMP(3),
  "description" TEXT,
  "reference" TEXT,
  "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "amountAbs" DECIMAL(18,2) NOT NULL,
  "direction" TEXT NOT NULL,
  "matchStatus" "BankMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
  "matchedEntityType" TEXT,
  "matchedEntityId" TEXT,
  "matchedAt" TIMESTAMP(3),
  "matchedByUserId" TEXT,
  "matchedByLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BankStatementRow_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BankStatementImport"
ADD CONSTRAINT "BankStatementImport_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BankStatementRow"
ADD CONSTRAINT "BankStatementRow_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BankStatementRow"
ADD CONSTRAINT "BankStatementRow_importId_fkey"
FOREIGN KEY ("importId") REFERENCES "BankStatementImport"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "BankStatementImport_tenantId_importedAt_idx" ON "BankStatementImport"("tenantId", "importedAt");
CREATE INDEX "BankStatementRow_tenantId_postedAt_idx" ON "BankStatementRow"("tenantId", "postedAt");
CREATE INDEX "BankStatementRow_tenantId_matchStatus_createdAt_idx" ON "BankStatementRow"("tenantId", "matchStatus", "createdAt");
CREATE INDEX "BankStatementRow_tenantId_matchedEntityType_matchedEntityId_idx" ON "BankStatementRow"("tenantId", "matchedEntityType", "matchedEntityId");
CREATE INDEX "BankStatementRow_importId_idx" ON "BankStatementRow"("importId");
