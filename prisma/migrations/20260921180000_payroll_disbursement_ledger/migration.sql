-- Payroll disbursement foundation: funding receipts + append-only ledger + balance cache

CREATE TYPE "PayrollFundingStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'VOIDED');

CREATE TYPE "PayrollLedgerEntryType" AS ENUM (
  'FUNDING_CREDIT',
  'PAYOUT_DEBIT',
  'FEE_DEBIT',
  'ADJUSTMENT_CREDIT',
  'ADJUSTMENT_DEBIT',
  'PAYOUT_REVERSAL'
);

ALTER TABLE "TenantSettings" ADD COLUMN "payrollDisbursementSettings" JSONB;

CREATE TABLE "PayrollFundingReceipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "paymentReference" TEXT NOT NULL,
    "senderName" TEXT,
    "senderBank" TEXT,
    "bankReceivedAt" TIMESTAMP(3),
    "status" "PayrollFundingStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdByLabel" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "verifiedByLabel" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectedByLabel" TEXT,
    "rejectionReason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" TEXT,
    "voidedByLabel" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollFundingReceipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollLedgerEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entryType" "PayrollLedgerEntryType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "balanceAfter" DECIMAL(18,2) NOT NULL,
    "fundingReceiptId" TEXT,
    "disbursementBatchId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdByLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollTenantBalance" (
    "tenantId" TEXT NOT NULL,
    "availableBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollTenantBalance_pkey" PRIMARY KEY ("tenantId")
);

CREATE UNIQUE INDEX "PayrollFundingReceipt_tenantId_paymentReference_key" ON "PayrollFundingReceipt"("tenantId", "paymentReference");
CREATE INDEX "PayrollFundingReceipt_tenantId_status_createdAt_idx" ON "PayrollFundingReceipt"("tenantId", "status", "createdAt");
CREATE INDEX "PayrollFundingReceipt_tenantId_createdAt_idx" ON "PayrollFundingReceipt"("tenantId", "createdAt");

CREATE UNIQUE INDEX "PayrollLedgerEntry_fundingReceiptId_key" ON "PayrollLedgerEntry"("fundingReceiptId");
CREATE UNIQUE INDEX "PayrollLedgerEntry_tenantId_idempotencyKey_key" ON "PayrollLedgerEntry"("tenantId", "idempotencyKey");
CREATE INDEX "PayrollLedgerEntry_tenantId_createdAt_idx" ON "PayrollLedgerEntry"("tenantId", "createdAt");
CREATE INDEX "PayrollLedgerEntry_tenantId_entryType_idx" ON "PayrollLedgerEntry"("tenantId", "entryType");

ALTER TABLE "PayrollFundingReceipt" ADD CONSTRAINT "PayrollFundingReceipt_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PayrollLedgerEntry" ADD CONSTRAINT "PayrollLedgerEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollLedgerEntry" ADD CONSTRAINT "PayrollLedgerEntry_fundingReceiptId_fkey" FOREIGN KEY ("fundingReceiptId") REFERENCES "PayrollFundingReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PayrollTenantBalance" ADD CONSTRAINT "PayrollTenantBalance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
