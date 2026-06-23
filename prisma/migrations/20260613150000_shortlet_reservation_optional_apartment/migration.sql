-- Reservations can exist without an apartment assigned (assign at check-in).
-- Optional property/location when apartment not yet chosen.

ALTER TABLE "ShortletReservation" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;

ALTER TABLE "ShortletReservation" ALTER COLUMN "unitId" DROP NOT NULL;

ALTER TABLE "ShortletReservation" DROP CONSTRAINT IF EXISTS "ShortletReservation_unitId_fkey";
ALTER TABLE "ShortletReservation" ADD CONSTRAINT "ShortletReservation_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "ShortletUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShortletReservation" ADD CONSTRAINT "ShortletReservation_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "ShortletProperty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ShortletReservation_tenantId_propertyId_idx" ON "ShortletReservation"("tenantId", "propertyId");
