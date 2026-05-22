-- AlterTable: add WhatsApp Cloud API config fields to TenantSettings
ALTER TABLE "TenantSettings"
  ADD COLUMN "whatsappAccessToken" TEXT,
  ADD COLUMN "whatsappPhoneNumberId" TEXT,
  ADD COLUMN "whatsappVerifyToken" TEXT;
