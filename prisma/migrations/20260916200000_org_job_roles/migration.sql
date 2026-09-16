-- Reusable job titles for People records.
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "orgJobRoles" JSONB;
