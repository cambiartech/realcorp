-- Add Meta delivery status tracking to WhatsApp messages
ALTER TABLE "WhatsAppMessage" ADD COLUMN "status" TEXT;
ALTER TABLE "WhatsAppMessage" ADD COLUMN "statusUpdatedAt" TIMESTAMP(3);

-- Index for webhook status updates that look up by Meta message id
CREATE INDEX "WhatsAppMessage_waMessageId_idx" ON "WhatsAppMessage"("waMessageId");
