ALTER TABLE "TenantSettings"
ADD COLUMN "cloudinaryCloudName" TEXT,
ADD COLUMN "cloudinaryApiKey" TEXT,
ADD COLUMN "cloudinaryApiSecret" TEXT,
ADD COLUMN "cloudinaryFolder" TEXT DEFAULT 'realcorp/finance';
