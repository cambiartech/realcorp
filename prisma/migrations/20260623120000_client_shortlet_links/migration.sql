CREATE TABLE "ClientShortletLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "shortletUnitId" TEXT NOT NULL,
    "role" "ClientUnitLinkRole" NOT NULL DEFAULT 'TENANT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientShortletLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientShortletLink_tenantId_clientId_shortletUnitId_key" ON "ClientShortletLink"("tenantId", "clientId", "shortletUnitId");
CREATE INDEX "ClientShortletLink_tenantId_clientId_idx" ON "ClientShortletLink"("tenantId", "clientId");
CREATE INDEX "ClientShortletLink_tenantId_shortletUnitId_idx" ON "ClientShortletLink"("tenantId", "shortletUnitId");

ALTER TABLE "ClientShortletLink" ADD CONSTRAINT "ClientShortletLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientShortletLink" ADD CONSTRAINT "ClientShortletLink_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "PropertyClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientShortletLink" ADD CONSTRAINT "ClientShortletLink_shortletUnitId_fkey" FOREIGN KEY ("shortletUnitId") REFERENCES "ShortletUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
