CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "FinanceExpenseCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceExpenseCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinanceExpenseCategory_tenantId_name_key" ON "FinanceExpenseCategory"("tenantId", "name");
CREATE INDEX "FinanceExpenseCategory_tenantId_name_idx" ON "FinanceExpenseCategory"("tenantId", "name");

ALTER TABLE "FinanceExpenseCategory" ADD CONSTRAINT "FinanceExpenseCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "FinanceExpenseCategory" ("id", "tenantId", "name", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    c."tenantId",
    c."name",
    NOW(),
    NOW()
FROM (
    SELECT DISTINCT "tenantId", TRIM("category") AS "name"
    FROM "Expense"
    WHERE TRIM("category") <> ''
) c
ON CONFLICT ("tenantId", "name") DO NOTHING;
