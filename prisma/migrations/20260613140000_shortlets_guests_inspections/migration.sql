-- ShortletGuest CRM, reservation status expansion, caution fee, checkout inspections

CREATE TYPE "ShortletGuestType" AS ENUM ('INDIVIDUAL', 'CORPORATE');
CREATE TYPE "ShortletInspectionStatus" AS ENUM ('AWAITING_INSPECTION', 'PASSED', 'FAILED', 'WAIVED');
CREATE TYPE "ShortletInspectionCondition" AS ENUM ('GOOD', 'DAMAGES_FOUND', 'MAINTENANCE_REQUIRED');

ALTER TYPE "ShortletReservationStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "ShortletReservationStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED';
ALTER TYPE "ShortletReservationStatus" ADD VALUE IF NOT EXISTS 'NO_SHOW';

ALTER TABLE "ShortletUnit" ADD COLUMN IF NOT EXISTS "cautionFee" DECIMAL(18,2);

ALTER TABLE "ShortletReservation" ADD COLUMN IF NOT EXISTS "guestId" TEXT;
ALTER TABLE "ShortletReservation" ADD COLUMN IF NOT EXISTS "bookingNumber" TEXT;
ALTER TABLE "ShortletReservation" ADD COLUMN IF NOT EXISTS "cautionFee" DECIMAL(18,2);
ALTER TABLE "ShortletReservation" ADD COLUMN IF NOT EXISTS "cautionFeePaid" DECIMAL(18,2) NOT NULL DEFAULT 0;

UPDATE "ShortletReservation" SET "status" = 'CONFIRMED' WHERE "status" = 'RESERVED';

ALTER TABLE "ShortletReservation" ALTER COLUMN "status" SET DEFAULT 'PENDING';

CREATE TABLE "ShortletGuest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "guestType" "ShortletGuestType" NOT NULL DEFAULT 'INDIVIDUAL',
    "idType" TEXT,
    "idNumber" TEXT,
    "idDocumentUrl" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT DEFAULT 'Nigeria',
    "notes" TEXT,
    "propertyClientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShortletGuest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShortletCheckoutInspection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "status" "ShortletInspectionStatus" NOT NULL DEFAULT 'AWAITING_INSPECTION',
    "condition" "ShortletInspectionCondition",
    "damageNotes" TEXT,
    "cautionFeeAmount" DECIMAL(18,2),
    "cautionRefunded" DECIMAL(18,2),
    "cautionDeduction" DECIMAL(18,2),
    "inspectedAt" TIMESTAMP(3),
    "inspectedByUserId" TEXT,
    "inspectedByLabel" TEXT,
    "housekeepingCompletedAt" TIMESTAMP(3),
    "housekeepingCompletedByLabel" TEXT,
    "photoUrls" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShortletCheckoutInspection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShortletCheckoutInspection_reservationId_key" ON "ShortletCheckoutInspection"("reservationId");
CREATE INDEX "ShortletCheckoutInspection_tenantId_status_idx" ON "ShortletCheckoutInspection"("tenantId", "status");
CREATE INDEX "ShortletCheckoutInspection_tenantId_unitId_idx" ON "ShortletCheckoutInspection"("tenantId", "unitId");
CREATE INDEX "ShortletGuest_tenantId_fullName_idx" ON "ShortletGuest"("tenantId", "fullName");
CREATE INDEX "ShortletGuest_tenantId_email_idx" ON "ShortletGuest"("tenantId", "email");
CREATE INDEX "ShortletGuest_tenantId_phone_idx" ON "ShortletGuest"("tenantId", "phone");
CREATE INDEX "ShortletReservation_tenantId_guestId_idx" ON "ShortletReservation"("tenantId", "guestId");
CREATE INDEX "ShortletReservation_tenantId_bookingNumber_idx" ON "ShortletReservation"("tenantId", "bookingNumber");

ALTER TABLE "ShortletGuest" ADD CONSTRAINT "ShortletGuest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShortletGuest" ADD CONSTRAINT "ShortletGuest_propertyClientId_fkey" FOREIGN KEY ("propertyClientId") REFERENCES "PropertyClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShortletCheckoutInspection" ADD CONSTRAINT "ShortletCheckoutInspection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShortletCheckoutInspection" ADD CONSTRAINT "ShortletCheckoutInspection_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "ShortletReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShortletCheckoutInspection" ADD CONSTRAINT "ShortletCheckoutInspection_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "ShortletUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShortletReservation" ADD CONSTRAINT "ShortletReservation_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "ShortletGuest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
