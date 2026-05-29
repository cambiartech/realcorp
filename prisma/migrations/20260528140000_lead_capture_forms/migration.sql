-- Lead capture forms (lead magnets)

CREATE TYPE "LeadCaptureFormStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED');
CREATE TYPE "LeadCaptureSessionStatus" AS ENUM ('VIEWED', 'STARTED', 'PARTIAL', 'COMPLETED', 'ABANDONED');
CREATE TYPE "LeadCaptureFormEventType" AS ENUM ('VIEW', 'START', 'FIELD_BLUR', 'PARTIAL_SAVE', 'SUBMIT', 'ABANDON');

CREATE TABLE "LeadCaptureForm" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "LeadCaptureFormStatus" NOT NULL DEFAULT 'DRAFT',
    "fields" JSONB NOT NULL,
    "thankYouMessage" TEXT,
    "redirectUrl" TEXT,
    "defaultSource" TEXT DEFAULT 'Lead Form',
    "campaignId" TEXT,
    "assignedUserId" TEXT,
    "realtorPartnerId" TEXT,
    "createdByUserId" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "startCount" INTEGER NOT NULL DEFAULT 0,
    "partialCount" INTEGER NOT NULL DEFAULT 0,
    "submitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadCaptureForm_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadCaptureFormSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "status" "LeadCaptureSessionStatus" NOT NULL DEFAULT 'VIEWED',
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "referrer" TEXT,
    "landingUrl" TEXT,
    "sharerUserId" TEXT,
    "realtorPartnerId" TEXT,
    "ipCountry" TEXT,
    "ipRegion" TEXT,
    "ipCity" TEXT,
    "timezone" TEXT,
    "localHour" INTEGER,
    "deviceType" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "userAgent" TEXT,
    "fieldsCompleted" JSONB,
    "completionPct" INTEGER NOT NULL DEFAULT 0,
    "lastFieldKey" TEXT,
    "leadId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadCaptureFormSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeadCaptureFormEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" "LeadCaptureFormEventType" NOT NULL,
    "fieldKey" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadCaptureFormEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeadCaptureForm_tenantId_slug_key" ON "LeadCaptureForm"("tenantId", "slug");
CREATE INDEX "LeadCaptureForm_tenantId_idx" ON "LeadCaptureForm"("tenantId");
CREATE INDEX "LeadCaptureForm_tenantId_status_idx" ON "LeadCaptureForm"("tenantId", "status");

CREATE UNIQUE INDEX "LeadCaptureFormSession_formId_sessionToken_key" ON "LeadCaptureFormSession"("formId", "sessionToken");
CREATE UNIQUE INDEX "LeadCaptureFormSession_leadId_key" ON "LeadCaptureFormSession"("leadId");
CREATE INDEX "LeadCaptureFormSession_tenantId_formId_idx" ON "LeadCaptureFormSession"("tenantId", "formId");
CREATE INDEX "LeadCaptureFormSession_formId_status_idx" ON "LeadCaptureFormSession"("formId", "status");

CREATE INDEX "LeadCaptureFormEvent_sessionId_idx" ON "LeadCaptureFormEvent"("sessionId");
CREATE INDEX "LeadCaptureFormEvent_formId_type_idx" ON "LeadCaptureFormEvent"("formId", "type");
CREATE INDEX "LeadCaptureFormEvent_tenantId_formId_idx" ON "LeadCaptureFormEvent"("tenantId", "formId");

ALTER TABLE "LeadCaptureForm" ADD CONSTRAINT "LeadCaptureForm_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadCaptureForm" ADD CONSTRAINT "LeadCaptureForm_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeadCaptureForm" ADD CONSTRAINT "LeadCaptureForm_realtorPartnerId_fkey" FOREIGN KEY ("realtorPartnerId") REFERENCES "RealtorPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadCaptureFormSession" ADD CONSTRAINT "LeadCaptureFormSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadCaptureFormSession" ADD CONSTRAINT "LeadCaptureFormSession_formId_fkey" FOREIGN KEY ("formId") REFERENCES "LeadCaptureForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadCaptureFormSession" ADD CONSTRAINT "LeadCaptureFormSession_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadCaptureFormEvent" ADD CONSTRAINT "LeadCaptureFormEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadCaptureFormEvent" ADD CONSTRAINT "LeadCaptureFormEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LeadCaptureFormSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
