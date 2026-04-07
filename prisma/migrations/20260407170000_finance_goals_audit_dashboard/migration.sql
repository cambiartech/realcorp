-- This migration backfills tables/enums required by the current schema + seed script.
-- It is intentionally additive to avoid destructive changes on existing DBs.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'VOID');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "FinanceReviewDecision" AS ENUM ('APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "TenantGoal" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "fiscalYearStart" TIMESTAMP(3) NOT NULL,
  "fiscalYearEnd" TIMESTAMP(3) NOT NULL,
  "revenueTarget" DECIMAL(18,2),
  "pipelineTarget" DECIMAL(18,2),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TenantGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TenantGoal_tenantId_isActive_idx" ON "TenantGoal"("tenantId", "isActive");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "TenantGoal"
    ADD CONSTRAINT "TenantGoal_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "DashboardPreference" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "roleView" TEXT,
  "widgetConfig" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DashboardPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DashboardPreference_tenantId_userId_key" ON "DashboardPreference"("tenantId", "userId");
CREATE INDEX IF NOT EXISTS "DashboardPreference_tenantId_idx" ON "DashboardPreference"("tenantId");
CREATE INDEX IF NOT EXISTS "DashboardPreference_userId_idx" ON "DashboardPreference"("userId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "DashboardPreference"
    ADD CONSTRAINT "DashboardPreference_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DashboardPreference"
    ADD CONSTRAINT "DashboardPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Invoice" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "dealId" TEXT,
  "invoiceNumber" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'SENT',
  "amount" DECIMAL(18,2) NOT NULL,
  "balanceDue" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "dueDate" TIMESTAMP(3),
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" TEXT,
  "createdByLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_tenantId_invoiceNumber_key" ON "Invoice"("tenantId", "invoiceNumber");
CREATE INDEX IF NOT EXISTS "Invoice_tenantId_status_idx" ON "Invoice"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Invoice_dealId_idx" ON "Invoice"("dealId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Invoice"
    ADD CONSTRAINT "Invoice_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Invoice"
    ADD CONSTRAINT "Invoice_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentRecord" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "paidAt" TIMESTAMP(3) NOT NULL,
  "method" TEXT,
  "reference" TEXT,
  "note" TEXT,
  "recordedByUserId" TEXT,
  "recordedByLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentRecord_tenantId_paidAt_idx" ON "PaymentRecord"("tenantId", "paidAt");
CREATE INDEX IF NOT EXISTS "PaymentRecord_invoiceId_idx" ON "PaymentRecord"("invoiceId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PaymentRecord"
    ADD CONSTRAINT "PaymentRecord_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentRecord"
    ADD CONSTRAINT "PaymentRecord_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "actorLabel" TEXT,
  "module" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "action" TEXT NOT NULL,
  "summary" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_tenantId_module_idx" ON "AuditLog"("tenantId", "module");
CREATE INDEX IF NOT EXISTS "AuditLog_tenantId_entityType_idx" ON "AuditLog"("tenantId", "entityType");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

