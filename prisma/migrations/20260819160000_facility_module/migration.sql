ALTER TYPE "MembershipRole" ADD VALUE IF NOT EXISTS 'FACILITY_MANAGER';
ALTER TYPE "MembershipRole" ADD VALUE IF NOT EXISTS 'FACILITY_STAFF';

ALTER TABLE "TenantSettings" ADD COLUMN "moduleFacility" BOOLEAN NOT NULL DEFAULT false;

CREATE TYPE "InventoryItemClass" AS ENUM ('MATERIAL', 'CONSUMABLE', 'EQUIPMENT', 'TOOL');
CREATE TYPE "InventoryLocationKind" AS ENUM ('CENTRAL', 'PROJECT');
CREATE TYPE "InventoryMovementType" AS ENUM ('RECEIVE', 'TRANSFER', 'ISSUE', 'ADJUST', 'DAMAGE');
CREATE TYPE "InventoryAssetStatus" AS ENUM ('AVAILABLE', 'ON_SITE', 'IN_SERVICE', 'DAMAGED', 'RETIRED');
CREATE TYPE "InventoryDamageStatus" AS ENUM ('OPEN', 'CONFIRMED', 'WRITTEN_OFF');

CREATE TABLE "InventoryItem" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sku" TEXT,
  "itemClass" "InventoryItemClass" NOT NULL,
  "unitOfMeasure" TEXT NOT NULL DEFAULT 'pcs',
  "reorderPoint" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryLocation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" "InventoryLocationKind" NOT NULL,
  "projectId" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InventoryLocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryBalance" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "quantity" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InventoryBalance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryMovement" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "type" "InventoryMovementType" NOT NULL,
  "quantity" DECIMAL(14,2) NOT NULL,
  "fromLocationId" TEXT,
  "toLocationId" TEXT,
  "projectId" TEXT,
  "unitId" TEXT,
  "notes" TEXT,
  "recordedByUserId" TEXT NOT NULL,
  "recordedByLabel" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryAsset" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "serialNumber" TEXT,
  "status" "InventoryAssetStatus" NOT NULL DEFAULT 'AVAILABLE',
  "projectId" TEXT,
  "locationId" TEXT,
  "lastServiceAt" TIMESTAMP(3),
  "nextServiceAt" TIMESTAMP(3),
  "serviceIntervalDays" INTEGER,
  "notes" TEXT,
  "photoUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InventoryAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryServiceLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "servicedAt" TIMESTAMP(3) NOT NULL,
  "nextDueAt" TIMESTAMP(3),
  "notes" TEXT,
  "recordedByUserId" TEXT NOT NULL,
  "recordedByLabel" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "InventoryServiceLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryDamage" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "itemId" TEXT,
  "assetId" TEXT,
  "projectId" TEXT,
  "locationId" TEXT,
  "unitId" TEXT,
  "quantity" DECIMAL(14,2),
  "status" "InventoryDamageStatus" NOT NULL DEFAULT 'OPEN',
  "description" TEXT NOT NULL,
  "estimatedCost" DECIMAL(18,2),
  "photoUrl" TEXT,
  "reportedByUserId" TEXT NOT NULL,
  "reportedByLabel" TEXT NOT NULL,
  "confirmedByLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InventoryDamage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventoryItem_tenantId_itemClass_idx" ON "InventoryItem"("tenantId", "itemClass");
CREATE INDEX "InventoryItem_tenantId_name_idx" ON "InventoryItem"("tenantId", "name");
CREATE INDEX "InventoryLocation_tenantId_kind_idx" ON "InventoryLocation"("tenantId", "kind");
CREATE INDEX "InventoryLocation_projectId_idx" ON "InventoryLocation"("projectId");
CREATE UNIQUE INDEX "InventoryBalance_itemId_locationId_key" ON "InventoryBalance"("itemId", "locationId");
CREATE INDEX "InventoryBalance_tenantId_locationId_idx" ON "InventoryBalance"("tenantId", "locationId");
CREATE INDEX "InventoryMovement_tenantId_createdAt_idx" ON "InventoryMovement"("tenantId", "createdAt");
CREATE INDEX "InventoryMovement_tenantId_type_createdAt_idx" ON "InventoryMovement"("tenantId", "type", "createdAt");
CREATE INDEX "InventoryMovement_itemId_createdAt_idx" ON "InventoryMovement"("itemId", "createdAt");
CREATE INDEX "InventoryMovement_projectId_idx" ON "InventoryMovement"("projectId");
CREATE INDEX "InventoryAsset_tenantId_status_idx" ON "InventoryAsset"("tenantId", "status");
CREATE INDEX "InventoryAsset_tenantId_nextServiceAt_idx" ON "InventoryAsset"("tenantId", "nextServiceAt");
CREATE INDEX "InventoryAsset_projectId_idx" ON "InventoryAsset"("projectId");
CREATE INDEX "InventoryServiceLog_assetId_servicedAt_idx" ON "InventoryServiceLog"("assetId", "servicedAt");
CREATE INDEX "InventoryServiceLog_tenantId_servicedAt_idx" ON "InventoryServiceLog"("tenantId", "servicedAt");
CREATE INDEX "InventoryDamage_tenantId_status_createdAt_idx" ON "InventoryDamage"("tenantId", "status", "createdAt");
CREATE INDEX "InventoryDamage_projectId_idx" ON "InventoryDamage"("projectId");

ALTER TABLE "InventoryItem"
  ADD CONSTRAINT "InventoryItem_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryLocation"
  ADD CONSTRAINT "InventoryLocation_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryLocation"
  ADD CONSTRAINT "InventoryLocation_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryBalance"
  ADD CONSTRAINT "InventoryBalance_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryBalance"
  ADD CONSTRAINT "InventoryBalance_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryBalance"
  ADD CONSTRAINT "InventoryBalance_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_fromLocationId_fkey"
  FOREIGN KEY ("fromLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_toLocationId_fkey"
  FOREIGN KEY ("toLocationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryAsset"
  ADD CONSTRAINT "InventoryAsset_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryAsset"
  ADD CONSTRAINT "InventoryAsset_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryAsset"
  ADD CONSTRAINT "InventoryAsset_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryAsset"
  ADD CONSTRAINT "InventoryAsset_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InventoryServiceLog"
  ADD CONSTRAINT "InventoryServiceLog_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryServiceLog"
  ADD CONSTRAINT "InventoryServiceLog_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "InventoryAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryDamage"
  ADD CONSTRAINT "InventoryDamage_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryDamage"
  ADD CONSTRAINT "InventoryDamage_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryDamage"
  ADD CONSTRAINT "InventoryDamage_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "InventoryAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryDamage"
  ADD CONSTRAINT "InventoryDamage_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryDamage"
  ADD CONSTRAINT "InventoryDamage_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryDamage"
  ADD CONSTRAINT "InventoryDamage_unitId_fkey"
  FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
