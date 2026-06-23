-- Expand locations (ShortletProperty) and apartments (ShortletUnit) for dedicated inventory UI

CREATE TYPE "ShortletListingStatus" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'MAINTENANCE');

ALTER TABLE "ShortletProperty" ADD COLUMN IF NOT EXISTS "locationCode" TEXT;
ALTER TABLE "ShortletProperty" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "ShortletProperty" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "ShortletProperty" ADD COLUMN IF NOT EXISTS "country" TEXT DEFAULT 'Nigeria';
ALTER TABLE "ShortletProperty" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "ShortletProperty" ADD COLUMN IF NOT EXISTS "email" TEXT;

ALTER TABLE "ShortletUnit" ADD COLUMN IF NOT EXISTS "floor" TEXT;
ALTER TABLE "ShortletUnit" ADD COLUMN IF NOT EXISTS "roomLayout" TEXT;
ALTER TABLE "ShortletUnit" ADD COLUMN IF NOT EXISTS "sizeSqFt" INTEGER;
ALTER TABLE "ShortletUnit" ADD COLUMN IF NOT EXISTS "maxOccupancy" INTEGER;
ALTER TABLE "ShortletUnit" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "ShortletUnit" ADD COLUMN IF NOT EXISTS "amenities" JSONB;
ALTER TABLE "ShortletUnit" ADD COLUMN IF NOT EXISTS "listingStatus" "ShortletListingStatus" NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE "ShortletUnit" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
