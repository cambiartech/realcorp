-- Realcorp Bot toggle per tenant
ALTER TABLE "TenantSettings" ADD COLUMN "whatsappBotEnabled" BOOLEAN NOT NULL DEFAULT false;
