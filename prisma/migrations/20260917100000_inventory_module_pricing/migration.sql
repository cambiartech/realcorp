-- Inventory module: parties, price history, receive pricing
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "moduleInventory" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "currentUnitPrice" DECIMAL(18, 2);

ALTER TABLE "InventoryMovement" ADD COLUMN IF NOT EXISTS "unitPrice" DECIMAL(18, 2);
ALTER TABLE "InventoryMovement" ADD COLUMN IF NOT EXISTS "partyId" TEXT;

DO $$ BEGIN
  CREATE TYPE "InventoryPartyKind" AS ENUM ('SUPPLIER', 'ARTISAN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryPriceSource" AS ENUM ('RECEIVE', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "InventoryParty" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "kind" "InventoryPartyKind" NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "specialty" TEXT,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryParty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InventoryPricePoint" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "unitPrice" DECIMAL(18, 2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" "InventoryPriceSource" NOT NULL,
  "partyId" TEXT,
  "movementId" TEXT,
  "notes" TEXT,
  "recordedByUserId" TEXT NOT NULL,
  "recordedByLabel" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryPricePoint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventoryParty_tenantId_kind_name_idx" ON "InventoryParty"("tenantId", "kind", "name");
CREATE INDEX IF NOT EXISTS "InventoryParty_tenantId_isActive_idx" ON "InventoryParty"("tenantId", "isActive");
CREATE INDEX IF NOT EXISTS "InventoryPricePoint_tenantId_itemId_effectiveAt_idx" ON "InventoryPricePoint"("tenantId", "itemId", "effectiveAt");
CREATE INDEX IF NOT EXISTS "InventoryPricePoint_tenantId_effectiveAt_idx" ON "InventoryPricePoint"("tenantId", "effectiveAt");
CREATE INDEX IF NOT EXISTS "InventoryPricePoint_partyId_idx" ON "InventoryPricePoint"("partyId");
CREATE INDEX IF NOT EXISTS "InventoryPricePoint_movementId_idx" ON "InventoryPricePoint"("movementId");
CREATE INDEX IF NOT EXISTS "InventoryMovement_partyId_idx" ON "InventoryMovement"("partyId");

DO $$ BEGIN
  ALTER TABLE "InventoryParty" ADD CONSTRAINT "InventoryParty_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryPricePoint" ADD CONSTRAINT "InventoryPricePoint_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryPricePoint" ADD CONSTRAINT "InventoryPricePoint_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryPricePoint" ADD CONSTRAINT "InventoryPricePoint_partyId_fkey"
    FOREIGN KEY ("partyId") REFERENCES "InventoryParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryPricePoint" ADD CONSTRAINT "InventoryPricePoint_movementId_fkey"
    FOREIGN KEY ("movementId") REFERENCES "InventoryMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_partyId_fkey"
    FOREIGN KEY ("partyId") REFERENCES "InventoryParty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
