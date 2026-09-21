-- Phase 1: payroll disbursement batches (Paystack transfers)

CREATE TYPE "PayrollDisbursementBatchStatus" AS ENUM (
  'DRAFT',
  'SENDING',
  'PARTIAL',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE "PayrollDisbursementLineStatus" AS ENUM (
  'PENDING',
  'SENDING',
  'SUCCESS',
  'FAILED',
  'REVERSED',
  'SKIPPED'
);

CREATE TABLE "PayrollDisbursementBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payslipRunId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'PAYSTACK',
    "status" "PayrollDisbursementBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "totalNet" DECIMAL(18,2) NOT NULL,
    "totalPlatformFee" DECIMAL(18,2) NOT NULL,
    "totalProviderFeeEstimate" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdByLabel" TEXT,
    "approvedByUserId" TEXT,
    "approvedByLabel" TEXT,
    "approvedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollDisbursementBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollDisbursementLine" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "employeeProfileId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "platformFee" DECIMAL(18,2) NOT NULL,
    "providerFeeEstimate" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "accountNumber" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNameResolved" TEXT,
    "recipientCode" TEXT,
    "providerReference" TEXT NOT NULL,
    "transferCode" TEXT,
    "providerTransferId" TEXT,
    "status" "PayrollDisbursementLineStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollDisbursementLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollDisbursementBatch_tenantId_idempotencyKey_key"
  ON "PayrollDisbursementBatch"("tenantId", "idempotencyKey");
CREATE INDEX "PayrollDisbursementBatch_tenantId_status_createdAt_idx"
  ON "PayrollDisbursementBatch"("tenantId", "status", "createdAt");
CREATE INDEX "PayrollDisbursementBatch_payslipRunId_idx"
  ON "PayrollDisbursementBatch"("payslipRunId");

CREATE UNIQUE INDEX "PayrollDisbursementLine_batchId_payslipId_key"
  ON "PayrollDisbursementLine"("batchId", "payslipId");
CREATE UNIQUE INDEX "PayrollDisbursementLine_tenantId_providerReference_key"
  ON "PayrollDisbursementLine"("tenantId", "providerReference");
CREATE INDEX "PayrollDisbursementLine_batchId_status_idx"
  ON "PayrollDisbursementLine"("batchId", "status");
CREATE INDEX "PayrollDisbursementLine_payslipId_idx"
  ON "PayrollDisbursementLine"("payslipId");
CREATE INDEX "PayrollDisbursementLine_tenantId_status_idx"
  ON "PayrollDisbursementLine"("tenantId", "status");

CREATE INDEX "HrPayslip_disbursementBatchId_idx" ON "HrPayslip"("disbursementBatchId");

ALTER TABLE "PayrollDisbursementBatch"
  ADD CONSTRAINT "PayrollDisbursementBatch_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollDisbursementBatch"
  ADD CONSTRAINT "PayrollDisbursementBatch_payslipRunId_fkey"
  FOREIGN KEY ("payslipRunId") REFERENCES "HrPayslipRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PayrollDisbursementLine"
  ADD CONSTRAINT "PayrollDisbursementLine_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "PayrollDisbursementBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollDisbursementLine"
  ADD CONSTRAINT "PayrollDisbursementLine_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollDisbursementLine"
  ADD CONSTRAINT "PayrollDisbursementLine_payslipId_fkey"
  FOREIGN KEY ("payslipId") REFERENCES "HrPayslip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
