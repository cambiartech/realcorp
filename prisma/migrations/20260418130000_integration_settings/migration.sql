-- AlterTable: add Meta Lead Ads + Termii config fields to TenantSettings
ALTER TABLE "TenantSettings"
  ADD COLUMN "metaVerifyToken"     TEXT,
  ADD COLUMN "metaPageAccessToken" TEXT,
  ADD COLUMN "metaDefaultSource"   TEXT DEFAULT 'Facebook',
  ADD COLUMN "termiiApiKey"        TEXT,
  ADD COLUMN "termiiSenderId"      TEXT DEFAULT 'Realcorp';
