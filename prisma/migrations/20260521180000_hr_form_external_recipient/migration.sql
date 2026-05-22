ALTER TABLE "HrFormRequest" ALTER COLUMN "employeeProfileId" DROP NOT NULL;
ALTER TABLE "HrFormRequest" ADD COLUMN IF NOT EXISTS "recipientName" TEXT;
ALTER TABLE "HrFormRequest" ADD COLUMN IF NOT EXISTS "recipientEmail" TEXT;
