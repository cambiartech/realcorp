-- AlterTable
ALTER TABLE "ShortletUnit" ADD COLUMN "photoUrls" JSONB;
ALTER TABLE "ShortletUnit" ADD COLUMN "airbnbListingId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ShortletUnit_airbnbListingId_key" ON "ShortletUnit"("airbnbListingId");

-- CreateTable
CREATE TABLE "AirbnbHostLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "airbnbUserId" TEXT,
    "accessTokenCipher" TEXT NOT NULL,
    "refreshTokenCipher" TEXT,
    "expiresAt" TIMESTAMP(3),
    "status" "ChannelConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AirbnbHostLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AirbnbHostLink_tenantId_key" ON "AirbnbHostLink"("tenantId");
CREATE INDEX "AirbnbHostLink_status_idx" ON "AirbnbHostLink"("status");

-- AddForeignKey
ALTER TABLE "AirbnbHostLink" ADD CONSTRAINT "AirbnbHostLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
