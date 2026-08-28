-- CreateTable
CREATE TABLE "ClientRemittance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyClientId" TEXT NOT NULL,
    "projectId" TEXT,
    "unitId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "remittedAt" TIMESTAMP(3) NOT NULL,
    "method" TEXT,
    "reference" TEXT,
    "note" TEXT,
    "recordedByUserId" TEXT,
    "recordedByLabel" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedByUserId" TEXT,
    "voidedByLabel" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientRemittance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientRemittance_tenantId_remittedAt_idx" ON "ClientRemittance"("tenantId", "remittedAt");
CREATE INDEX "ClientRemittance_tenantId_propertyClientId_idx" ON "ClientRemittance"("tenantId", "propertyClientId");
CREATE INDEX "ClientRemittance_tenantId_projectId_unitId_idx" ON "ClientRemittance"("tenantId", "projectId", "unitId");
CREATE INDEX "ClientRemittance_tenantId_voidedAt_idx" ON "ClientRemittance"("tenantId", "voidedAt");

ALTER TABLE "ClientRemittance" ADD CONSTRAINT "ClientRemittance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientRemittance" ADD CONSTRAINT "ClientRemittance_propertyClientId_fkey" FOREIGN KEY ("propertyClientId") REFERENCES "PropertyClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientRemittance" ADD CONSTRAINT "ClientRemittance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientRemittance" ADD CONSTRAINT "ClientRemittance_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
