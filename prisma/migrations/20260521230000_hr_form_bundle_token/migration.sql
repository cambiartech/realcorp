ALTER TABLE "HrFormRequest" ADD COLUMN IF NOT EXISTS "bundleToken" TEXT;

CREATE INDEX IF NOT EXISTS "HrFormRequest_bundleToken_idx" ON "HrFormRequest"("bundleToken");
