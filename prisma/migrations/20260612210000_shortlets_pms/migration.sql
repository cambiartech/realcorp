-- Short Lets PMS: housekeeping status, folio, service catalog, business day, role

ALTER TYPE "MembershipRole" ADD VALUE IF NOT EXISTS 'HOUSEKEEPING_MANAGER';

CREATE TYPE "ShortletHousekeepingStatus" AS ENUM ('VACANT_CLEAN', 'VACANT_DIRTY', 'OCCUPIED', 'OUT_OF_ORDER');
CREATE TYPE "ShortletFolioDepartment" AS ENUM ('ROOM', 'FNB', 'LAUNDRY', 'LOUNGE', 'GYM', 'OTHER');

ALTER TABLE "ShortletUnit" ADD COLUMN "housekeepingStatus" "ShortletHousekeepingStatus";
UPDATE "ShortletUnit" SET "housekeepingStatus" = CASE
  WHEN "status"::text = 'AVAILABLE' THEN 'VACANT_CLEAN'::"ShortletHousekeepingStatus"
  WHEN "status"::text = 'OCCUPIED' THEN 'OCCUPIED'::"ShortletHousekeepingStatus"
  WHEN "status"::text = 'MAINTENANCE' THEN 'OUT_OF_ORDER'::"ShortletHousekeepingStatus"
  ELSE 'VACANT_CLEAN'::"ShortletHousekeepingStatus"
END;
ALTER TABLE "ShortletUnit" ALTER COLUMN "housekeepingStatus" SET NOT NULL;
ALTER TABLE "ShortletUnit" ALTER COLUMN "housekeepingStatus" SET DEFAULT 'VACANT_CLEAN';

ALTER TABLE "ShortletUnit" DROP COLUMN "status";
DROP TYPE "ShortletUnitStatus";

ALTER TABLE "ShortletUnit" ADD COLUMN "assignedToUserId" TEXT;
ALTER TABLE "ShortletUnit" ADD COLUMN "assignedToLabel" TEXT;

DROP INDEX IF EXISTS "ShortletUnit_tenantId_status_idx";
CREATE INDEX "ShortletUnit_tenantId_housekeepingStatus_idx" ON "ShortletUnit"("tenantId", "housekeepingStatus");

ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "shortletCheckInTime" TEXT NOT NULL DEFAULT '14:00';
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "shortletCheckOutTime" TEXT NOT NULL DEFAULT '12:00';
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "shortletEodTime" TEXT NOT NULL DEFAULT '23:59';
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "shortletCheckoutAlertHours" INTEGER NOT NULL DEFAULT 2;

ALTER TABLE "ShortletReservation" ADD COLUMN IF NOT EXISTS "isWalkIn" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ShortletServiceItem" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "department" "ShortletFolioDepartment" NOT NULL,
  "name" TEXT NOT NULL,
  "price" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShortletServiceItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShortletFolioLine" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "reservationId" TEXT NOT NULL,
  "serviceItemId" TEXT,
  "department" "ShortletFolioDepartment" NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPrice" DECIMAL(18,2) NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "postedByUserId" TEXT,
  "postedByLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShortletFolioLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShortletBusinessDay" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessDate" DATE NOT NULL,
  "closedAt" TIMESTAMP(3) NOT NULL,
  "closedByUserId" TEXT,
  "closedByLabel" TEXT,
  "snapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShortletBusinessDay_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShortletServiceItem_tenantId_department_active_idx" ON "ShortletServiceItem"("tenantId", "department", "active");
CREATE INDEX "ShortletFolioLine_tenantId_postedAt_idx" ON "ShortletFolioLine"("tenantId", "postedAt");
CREATE INDEX "ShortletFolioLine_reservationId_idx" ON "ShortletFolioLine"("reservationId");
CREATE UNIQUE INDEX "ShortletBusinessDay_tenantId_businessDate_key" ON "ShortletBusinessDay"("tenantId", "businessDate");
CREATE INDEX "ShortletBusinessDay_tenantId_closedAt_idx" ON "ShortletBusinessDay"("tenantId", "closedAt");

ALTER TABLE "ShortletServiceItem" ADD CONSTRAINT "ShortletServiceItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShortletFolioLine" ADD CONSTRAINT "ShortletFolioLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShortletFolioLine" ADD CONSTRAINT "ShortletFolioLine_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "ShortletReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShortletFolioLine" ADD CONSTRAINT "ShortletFolioLine_serviceItemId_fkey" FOREIGN KEY ("serviceItemId") REFERENCES "ShortletServiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShortletBusinessDay" ADD CONSTRAINT "ShortletBusinessDay_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
