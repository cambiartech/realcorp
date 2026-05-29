-- Phase 3: auto WhatsApp follow-up on capture form submit

ALTER TABLE "LeadCaptureForm" ADD COLUMN IF NOT EXISTS "autoWhatsAppEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LeadCaptureForm" ADD COLUMN IF NOT EXISTS "autoWhatsAppMessage" TEXT;
