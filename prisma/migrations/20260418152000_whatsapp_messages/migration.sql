-- CreateTable
CREATE TABLE "WhatsAppMessage" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "leadId" TEXT,
  "direction" TEXT NOT NULL,
  "waMessageId" TEXT,
  "fromPhone" TEXT,
  "toPhone" TEXT,
  "body" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "WhatsAppMessage_tenantId_timestamp_idx" ON "WhatsAppMessage"("tenantId", "timestamp");
CREATE INDEX "WhatsAppMessage_tenantId_leadId_timestamp_idx" ON "WhatsAppMessage"("tenantId", "leadId", "timestamp");
