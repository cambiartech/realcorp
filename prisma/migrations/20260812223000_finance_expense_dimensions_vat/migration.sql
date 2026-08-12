CREATE TYPE "FinanceVatTreatment" AS ENUM ('NONE', 'EXCLUSIVE', 'INCLUSIVE', 'EXEMPT', 'ZERO_RATED');

ALTER TABLE "Expense"
ADD COLUMN "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN "vatAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN "vatTreatment" "FinanceVatTreatment" NOT NULL DEFAULT 'NONE',
ADD COLUMN "vatRecoverable" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Expense" SET "subtotal" = "amount";

UPDATE "Expense" e
SET "projectId" = NULL
WHERE "projectId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Project" p
    WHERE p."id" = e."projectId" AND p."tenantId" = e."tenantId"
  );

UPDATE "Expense" e
SET "unitId" = NULL
WHERE "unitId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Unit" u
    WHERE u."id" = e."unitId" AND u."tenantId" = e."tenantId"
  );

UPDATE "Expense" e
SET "projectId" = u."projectId"
FROM "Unit" u
WHERE e."unitId" = u."id"
  AND (e."projectId" IS NULL OR e."projectId" <> u."projectId");

CREATE INDEX "Expense_tenantId_projectId_unitId_idx"
ON "Expense"("tenantId", "projectId", "unitId");

ALTER TABLE "Expense"
ADD CONSTRAINT "Expense_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Expense"
ADD CONSTRAINT "Expense_unitId_fkey"
FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
