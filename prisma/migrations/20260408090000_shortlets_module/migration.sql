-- Short Lets add-on module

ALTER TABLE "TenantSettings"
  ADD COLUMN IF NOT EXISTS "moduleShortLets" BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  CREATE TYPE "ShortletUnitStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ShortletReservationStatus" AS ENUM ('RESERVED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ShortletUnit" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "location" TEXT,
  "nightlyRate" DECIMAL(18,2) NOT NULL,
  "cleaningFee" DECIMAL(18,2),
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "status" "ShortletUnitStatus" NOT NULL DEFAULT 'AVAILABLE',
  "activeReservationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShortletUnit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ShortletReservation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "guestName" TEXT NOT NULL,
  "guestEmail" TEXT,
  "guestPhone" TEXT,
  "checkIn" TIMESTAMP(3) NOT NULL,
  "checkOut" TIMESTAMP(3) NOT NULL,
  "nights" INTEGER NOT NULL,
  "totalAmount" DECIMAL(18,2) NOT NULL,
  "amountPaid" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "balanceDue" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "status" "ShortletReservationStatus" NOT NULL DEFAULT 'RESERVED',
  "notes" TEXT,
  "createdByUserId" TEXT,
  "createdByLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShortletReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ShortletPayment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "paidAt" TIMESTAMP(3) NOT NULL,
  "method" TEXT,
  "reference" TEXT,
  "note" TEXT,
  "recordedByUserId" TEXT,
  "recordedByLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShortletPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShortletUnit_activeReservationId_key" ON "ShortletUnit"("activeReservationId");
CREATE INDEX IF NOT EXISTS "ShortletUnit_tenantId_status_idx" ON "ShortletUnit"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "ShortletUnit_tenantId_createdAt_idx" ON "ShortletUnit"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "ShortletReservation_tenantId_status_idx" ON "ShortletReservation"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "ShortletReservation_tenantId_checkIn_checkOut_idx" ON "ShortletReservation"("tenantId", "checkIn", "checkOut");
CREATE INDEX IF NOT EXISTS "ShortletReservation_unitId_status_idx" ON "ShortletReservation"("unitId", "status");
CREATE INDEX IF NOT EXISTS "ShortletPayment_tenantId_paidAt_idx" ON "ShortletPayment"("tenantId", "paidAt");
CREATE INDEX IF NOT EXISTS "ShortletPayment_reservationId_idx" ON "ShortletPayment"("reservationId");

DO $$ BEGIN
  ALTER TABLE "ShortletUnit"
    ADD CONSTRAINT "ShortletUnit_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ShortletReservation"
    ADD CONSTRAINT "ShortletReservation_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ShortletReservation"
    ADD CONSTRAINT "ShortletReservation_unitId_fkey"
    FOREIGN KEY ("unitId") REFERENCES "ShortletUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ShortletPayment"
    ADD CONSTRAINT "ShortletPayment_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ShortletPayment"
    ADD CONSTRAINT "ShortletPayment_reservationId_fkey"
    FOREIGN KEY ("reservationId") REFERENCES "ShortletReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ShortletUnit"
    ADD CONSTRAINT "ShortletUnit_activeReservationId_fkey"
    FOREIGN KEY ("activeReservationId") REFERENCES "ShortletReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
