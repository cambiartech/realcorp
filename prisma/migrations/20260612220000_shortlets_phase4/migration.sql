-- Phase 4: multi-property, guest CRM, channel source, finance bridge

CREATE TYPE "ShortletReservationSource" AS ENUM ('DIRECT', 'WALK_IN', 'EXPLORE', 'PHONE', 'OTA');

CREATE TABLE "ShortletProperty" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "address" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ShortletProperty_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "shortletFinanceSync" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ShortletUnit" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;

ALTER TABLE "ShortletReservation" ADD COLUMN IF NOT EXISTS "guestClientId" TEXT;
ALTER TABLE "ShortletReservation" ADD COLUMN IF NOT EXISTS "channelLeadId" TEXT;
ALTER TABLE "ShortletReservation" ADD COLUMN IF NOT EXISTS "source" "ShortletReservationSource" NOT NULL DEFAULT 'DIRECT';

ALTER TABLE "ShortletPayment" ADD COLUMN IF NOT EXISTS "financeReceiptId" TEXT;

ALTER TABLE "ShortletBusinessDay" ADD COLUMN IF NOT EXISTS "financeReceiptId" TEXT;

CREATE INDEX "ShortletProperty_tenantId_isActive_idx" ON "ShortletProperty"("tenantId", "isActive");
CREATE INDEX "ShortletProperty_tenantId_sortOrder_idx" ON "ShortletProperty"("tenantId", "sortOrder");

CREATE INDEX "ShortletUnit_tenantId_propertyId_idx" ON "ShortletUnit"("tenantId", "propertyId");

CREATE INDEX "ShortletReservation_tenantId_guestClientId_idx" ON "ShortletReservation"("tenantId", "guestClientId");
CREATE INDEX "ShortletReservation_tenantId_channelLeadId_idx" ON "ShortletReservation"("tenantId", "channelLeadId");

CREATE INDEX "ShortletPayment_financeReceiptId_idx" ON "ShortletPayment"("financeReceiptId");
CREATE INDEX "ShortletBusinessDay_financeReceiptId_idx" ON "ShortletBusinessDay"("financeReceiptId");

ALTER TABLE "ShortletProperty" ADD CONSTRAINT "ShortletProperty_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShortletUnit" ADD CONSTRAINT "ShortletUnit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "ShortletProperty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShortletReservation" ADD CONSTRAINT "ShortletReservation_guestClientId_fkey" FOREIGN KEY ("guestClientId") REFERENCES "PropertyClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShortletReservation" ADD CONSTRAINT "ShortletReservation_channelLeadId_fkey" FOREIGN KEY ("channelLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShortletPayment" ADD CONSTRAINT "ShortletPayment_financeReceiptId_fkey" FOREIGN KEY ("financeReceiptId") REFERENCES "SalesReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShortletBusinessDay" ADD CONSTRAINT "ShortletBusinessDay_financeReceiptId_fkey" FOREIGN KEY ("financeReceiptId") REFERENCES "SalesReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
