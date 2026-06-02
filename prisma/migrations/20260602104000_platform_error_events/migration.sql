-- CreateTable
CREATE TABLE "PlatformErrorEvent" (
    "id" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "name" TEXT,
    "message" TEXT,
    "stack" TEXT,
    "routePath" TEXT,
    "requestUrl" TEXT,
    "tenantSlug" TEXT,
    "tenantId" TEXT,
    "userId" TEXT,
    "userEmail" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformErrorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformErrorEvent_digest_createdAt_idx" ON "PlatformErrorEvent"("digest", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformErrorEvent_tenantId_createdAt_idx" ON "PlatformErrorEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "PlatformErrorEvent_tenantSlug_createdAt_idx" ON "PlatformErrorEvent"("tenantSlug", "createdAt");

-- AddForeignKey
ALTER TABLE "PlatformErrorEvent" ADD CONSTRAINT "PlatformErrorEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
