-- CreateEnum
CREATE TYPE "ChannelProvider" AS ENUM ('PELLOWS', 'AIRBNB', 'BOOKING_COM', 'ICAL');

-- CreateEnum
CREATE TYPE "ChannelConnectionStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "ChannelConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" "ChannelProvider" NOT NULL,
    "status" "ChannelConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "scopes" TEXT NOT NULL DEFAULT 'shortlets.read',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "ChannelConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelCalendarFeed" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "feedToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelCalendarFeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelCalendarImport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "provider" "ChannelProvider" NOT NULL,
    "icalUrl" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelCalendarImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelExternalBlock" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "provider" "ChannelProvider" NOT NULL,
    "externalUid" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelExternalBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelConnection_tokenHash_key" ON "ChannelConnection"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelConnection_tenantId_provider_key" ON "ChannelConnection"("tenantId", "provider");

-- CreateIndex
CREATE INDEX "ChannelConnection_tenantId_status_idx" ON "ChannelConnection"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelCalendarFeed_unitId_key" ON "ChannelCalendarFeed"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelCalendarFeed_feedToken_key" ON "ChannelCalendarFeed"("feedToken");

-- CreateIndex
CREATE INDEX "ChannelCalendarFeed_tenantId_idx" ON "ChannelCalendarFeed"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelCalendarImport_unitId_provider_key" ON "ChannelCalendarImport"("unitId", "provider");

-- CreateIndex
CREATE INDEX "ChannelCalendarImport_tenantId_idx" ON "ChannelCalendarImport"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelExternalBlock_unitId_provider_externalUid_key" ON "ChannelExternalBlock"("unitId", "provider", "externalUid");

-- CreateIndex
CREATE INDEX "ChannelExternalBlock_tenantId_unitId_startDate_idx" ON "ChannelExternalBlock"("tenantId", "unitId", "startDate");

-- AddForeignKey
ALTER TABLE "ChannelConnection" ADD CONSTRAINT "ChannelConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelCalendarFeed" ADD CONSTRAINT "ChannelCalendarFeed_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelCalendarFeed" ADD CONSTRAINT "ChannelCalendarFeed_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "ShortletUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelCalendarImport" ADD CONSTRAINT "ChannelCalendarImport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelCalendarImport" ADD CONSTRAINT "ChannelCalendarImport_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "ShortletUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelExternalBlock" ADD CONSTRAINT "ChannelExternalBlock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelExternalBlock" ADD CONSTRAINT "ChannelExternalBlock_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "ShortletUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
