CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateTable
CREATE TABLE "FinanceVendor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceVendor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceVendor_tenantId_name_key" ON "FinanceVendor"("tenantId", "name");

-- CreateIndex
CREATE INDEX "FinanceVendor_tenantId_name_idx" ON "FinanceVendor"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "FinanceVendor" ADD CONSTRAINT "FinanceVendor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from existing bills and expenses
INSERT INTO "FinanceVendor" ("id", "tenantId", "name", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    v."tenantId",
    v."name",
    NOW(),
    NOW()
FROM (
    SELECT DISTINCT "tenantId", TRIM("vendorName") AS "name"
    FROM "VendorBill"
    WHERE TRIM("vendorName") <> ''
    UNION
    SELECT DISTINCT "tenantId", TRIM("vendorName") AS "name"
    FROM "Expense"
    WHERE "vendorName" IS NOT NULL AND TRIM("vendorName") <> ''
) v
ON CONFLICT ("tenantId", "name") DO NOTHING;
