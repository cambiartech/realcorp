-- CreateEnum
CREATE TYPE "VendorBillStatus" AS ENUM ('OPEN', 'PARTIAL', 'PAID', 'VOID');

-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN "financeControls" JSONB;

-- CreateTable
CREATE TABLE "VendorBill" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT,
    "unitId" TEXT,
    "billNumber" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "VendorBillStatus" NOT NULL DEFAULT 'OPEN',
    "amount" DECIMAL(18,2) NOT NULL,
    "balanceDue" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "department" TEXT,
    "dueDate" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdByLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorBillPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" TEXT,
    "reference" TEXT,
    "paidThroughAccount" TEXT,
    "recordedByUserId" TEXT,
    "recordedByLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorBillPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VendorBill_tenantId_billNumber_key" ON "VendorBill"("tenantId", "billNumber");

-- CreateIndex
CREATE INDEX "VendorBill_tenantId_status_idx" ON "VendorBill"("tenantId", "status");

-- CreateIndex
CREATE INDEX "VendorBill_tenantId_dueDate_idx" ON "VendorBill"("tenantId", "dueDate");

-- CreateIndex
CREATE INDEX "VendorBillPayment_tenantId_paidAt_idx" ON "VendorBillPayment"("tenantId", "paidAt");

-- CreateIndex
CREATE INDEX "VendorBillPayment_billId_idx" ON "VendorBillPayment"("billId");

-- AddForeignKey
ALTER TABLE "VendorBill" ADD CONSTRAINT "VendorBill_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBillPayment" ADD CONSTRAINT "VendorBillPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorBillPayment" ADD CONSTRAINT "VendorBillPayment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "VendorBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
