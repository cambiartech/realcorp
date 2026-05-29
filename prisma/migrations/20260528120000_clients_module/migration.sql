-- Clients module: property owners / investors, unit links, documents

CREATE TYPE "PropertyClientStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'FORMER');
CREATE TYPE "ClientUnitLinkRole" AS ENUM ('OWNER', 'CO_OWNER', 'TENANT', 'INVESTOR', 'BENEFICIARY');
CREATE TYPE "ClientDocumentCategory" AS ENUM (
  'ID',
  'PURCHASE_AGREEMENT',
  'ALLOCATION_LETTER',
  'RECEIPT',
  'DEED',
  'TENANCY',
  'CORRESPONDENCE',
  'OTHER'
);

ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "moduleClients" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "PropertyClient" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT,
    "dealId" TEXT,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "alternatePhone" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT DEFAULT 'Nigeria',
    "status" "PropertyClientStatus" NOT NULL DEFAULT 'PROSPECT',
    "notes" TEXT,
    "assignedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientUnitLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "pricingPlanId" TEXT,
    "role" "ClientUnitLinkRole" NOT NULL DEFAULT 'OWNER',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientUnitLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "category" "ClientDocumentCategory" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "uploadedByUserId" TEXT,
    "uploadedByLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PropertyClient_leadId_key" ON "PropertyClient"("leadId");
CREATE UNIQUE INDEX "PropertyClient_dealId_key" ON "PropertyClient"("dealId");
CREATE INDEX "PropertyClient_tenantId_status_idx" ON "PropertyClient"("tenantId", "status");
CREATE INDEX "PropertyClient_tenantId_fullName_idx" ON "PropertyClient"("tenantId", "fullName");

CREATE UNIQUE INDEX "ClientUnitLink_tenantId_clientId_unitId_key" ON "ClientUnitLink"("tenantId", "clientId", "unitId");
CREATE INDEX "ClientUnitLink_tenantId_clientId_idx" ON "ClientUnitLink"("tenantId", "clientId");
CREATE INDEX "ClientUnitLink_tenantId_unitId_idx" ON "ClientUnitLink"("tenantId", "unitId");

CREATE INDEX "ClientDocument_tenantId_clientId_idx" ON "ClientDocument"("tenantId", "clientId");
CREATE INDEX "ClientDocument_tenantId_category_idx" ON "ClientDocument"("tenantId", "category");

ALTER TABLE "PropertyClient" ADD CONSTRAINT "PropertyClient_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyClient" ADD CONSTRAINT "PropertyClient_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PropertyClient" ADD CONSTRAINT "PropertyClient_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClientUnitLink" ADD CONSTRAINT "ClientUnitLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientUnitLink" ADD CONSTRAINT "ClientUnitLink_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "PropertyClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientUnitLink" ADD CONSTRAINT "ClientUnitLink_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientUnitLink" ADD CONSTRAINT "ClientUnitLink_pricingPlanId_fkey" FOREIGN KEY ("pricingPlanId") REFERENCES "ProjectPricingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "PropertyClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
