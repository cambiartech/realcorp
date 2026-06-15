-- Growth & channels module toggles (platform admin controls these per tenant plan)
ALTER TABLE "TenantSettings" ADD COLUMN "moduleWhatsApp" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TenantSettings" ADD COLUMN "moduleListings" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TenantSettings" ADD COLUMN "moduleInvestorPortal" BOOLEAN NOT NULL DEFAULT false;
