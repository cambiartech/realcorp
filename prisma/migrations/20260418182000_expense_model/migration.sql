CREATE TABLE "Expense" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "projectId" TEXT,
  "unitId" TEXT,
  "category" TEXT NOT NULL,
  "vendorName" TEXT,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "expenseDate" TIMESTAMP(3) NOT NULL,
  "paidThroughAccount" TEXT,
  "reference" TEXT,
  "note" TEXT,
  "attachmentUrl" TEXT,
  "attachmentName" TEXT,
  "attachmentPublicId" TEXT,
  "createdByUserId" TEXT,
  "createdByLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Expense"
ADD CONSTRAINT "Expense_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Expense_tenantId_expenseDate_idx" ON "Expense"("tenantId", "expenseDate");
CREATE INDEX "Expense_tenantId_category_idx" ON "Expense"("tenantId", "category");
