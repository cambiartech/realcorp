CREATE TABLE "SalesReceipt" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "dealId" TEXT,
  "receiptNumber" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "customerName" TEXT,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "paymentMode" TEXT,
  "depositAccount" TEXT,
  "reference" TEXT,
  "note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RECORDED',
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" TEXT,
  "createdByLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesReceipt_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SalesReceipt"
ADD CONSTRAINT "SalesReceipt_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalesReceipt"
ADD CONSTRAINT "SalesReceipt_dealId_fkey"
FOREIGN KEY ("dealId") REFERENCES "Deal"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "SalesReceipt_tenantId_receiptNumber_key" ON "SalesReceipt"("tenantId", "receiptNumber");
CREATE INDEX "SalesReceipt_tenantId_issuedAt_idx" ON "SalesReceipt"("tenantId", "issuedAt");
CREATE INDEX "SalesReceipt_tenantId_dealId_idx" ON "SalesReceipt"("tenantId", "dealId");
