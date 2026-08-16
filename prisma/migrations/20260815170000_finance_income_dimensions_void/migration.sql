CREATE TYPE "FinanceIncomeType" AS ENUM ('CLIENT_DEPOSIT', 'MILESTONE', 'SHORTLET_REVENUE', 'OTHER');

ALTER TABLE "Invoice"
ADD COLUMN "projectId" TEXT,
ADD COLUMN "unitId" TEXT,
ADD COLUMN "incomeType" "FinanceIncomeType" NOT NULL DEFAULT 'OTHER';

ALTER TABLE "PaymentRecord"
ADD COLUMN "projectId" TEXT,
ADD COLUMN "unitId" TEXT,
ADD COLUMN "incomeType" "FinanceIncomeType" NOT NULL DEFAULT 'OTHER',
ADD COLUMN "voidedAt" TIMESTAMP(3),
ADD COLUMN "voidedByUserId" TEXT,
ADD COLUMN "voidedByLabel" TEXT,
ADD COLUMN "voidReason" TEXT;

ALTER TABLE "Expense"
ADD COLUMN "voidedAt" TIMESTAMP(3),
ADD COLUMN "voidedByUserId" TEXT,
ADD COLUMN "voidedByLabel" TEXT,
ADD COLUMN "voidReason" TEXT;

ALTER TABLE "SalesReceipt"
ADD COLUMN "projectId" TEXT,
ADD COLUMN "unitId" TEXT,
ADD COLUMN "incomeType" "FinanceIncomeType" NOT NULL DEFAULT 'OTHER',
ADD COLUMN "voidedAt" TIMESTAMP(3),
ADD COLUMN "voidedByUserId" TEXT,
ADD COLUMN "voidedByLabel" TEXT,
ADD COLUMN "voidReason" TEXT;

UPDATE "Invoice" i
SET "projectId" = u."projectId", "unitId" = u."id"
FROM "Deal" d
JOIN "Unit" u ON u."id" = d."unitId"
WHERE i."dealId" = d."id"
  AND i."unitId" IS NULL;

UPDATE "PaymentRecord" p
SET "projectId" = i."projectId",
    "unitId" = i."unitId",
    "incomeType" = i."incomeType"
FROM "Invoice" i
WHERE p."invoiceId" = i."id";

UPDATE "SalesReceipt" r
SET "projectId" = u."projectId", "unitId" = u."id"
FROM "Deal" d
JOIN "Unit" u ON u."id" = d."unitId"
WHERE r."dealId" = d."id"
  AND r."unitId" IS NULL;

UPDATE "SalesReceipt" r
SET "projectId" = pu."projectId",
    "unitId" = pu."id",
    "incomeType" = 'SHORTLET_REVENUE'
FROM "ShortletPayment" sp
JOIN "ShortletReservation" sr ON sr."id" = sp."reservationId"
JOIN "ShortletUnit" su ON su."id" = sr."unitId"
JOIN "Unit" pu ON pu."id" = su."projectUnitId"
WHERE sp."financeReceiptId" = r."id";

CREATE INDEX "Invoice_tenantId_projectId_unitId_idx" ON "Invoice"("tenantId", "projectId", "unitId");
CREATE INDEX "PaymentRecord_tenantId_projectId_unitId_idx" ON "PaymentRecord"("tenantId", "projectId", "unitId");
CREATE INDEX "PaymentRecord_tenantId_voidedAt_idx" ON "PaymentRecord"("tenantId", "voidedAt");
CREATE INDEX "Expense_tenantId_voidedAt_idx" ON "Expense"("tenantId", "voidedAt");
CREATE INDEX "SalesReceipt_tenantId_projectId_unitId_idx" ON "SalesReceipt"("tenantId", "projectId", "unitId");
CREATE INDEX "SalesReceipt_tenantId_status_idx" ON "SalesReceipt"("tenantId", "status");

ALTER TABLE "Invoice"
ADD CONSTRAINT "Invoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "Invoice_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentRecord"
ADD CONSTRAINT "PaymentRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "PaymentRecord_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalesReceipt"
ADD CONSTRAINT "SalesReceipt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "SalesReceipt_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
