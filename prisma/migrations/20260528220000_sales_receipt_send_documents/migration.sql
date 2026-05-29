-- Sales receipt send + org finance document filing

ALTER TABLE "SalesReceipt" ADD COLUMN IF NOT EXISTS "pdfUrl" TEXT;
ALTER TABLE "SalesReceipt" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
ALTER TABLE "SalesReceipt" ADD COLUMN IF NOT EXISTS "sentToEmail" TEXT;

CREATE TYPE "FinanceDocumentCategory" AS ENUM ('RECEIPT', 'INVOICE', 'OTHER');

CREATE TABLE "FinanceDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" "FinanceDocumentCategory" NOT NULL DEFAULT 'RECEIPT',
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "salesReceiptId" TEXT,
    "uploadedByUserId" TEXT,
    "uploadedByLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinanceDocument_salesReceiptId_key" ON "FinanceDocument"("salesReceiptId");
CREATE INDEX "FinanceDocument_tenantId_category_idx" ON "FinanceDocument"("tenantId", "category");
CREATE INDEX "FinanceDocument_tenantId_createdAt_idx" ON "FinanceDocument"("tenantId", "createdAt");

ALTER TABLE "FinanceDocument" ADD CONSTRAINT "FinanceDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceDocument" ADD CONSTRAINT "FinanceDocument_salesReceiptId_fkey" FOREIGN KEY ("salesReceiptId") REFERENCES "SalesReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
