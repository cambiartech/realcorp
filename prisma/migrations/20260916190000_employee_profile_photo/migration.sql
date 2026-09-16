-- Employee passport / headshot for HR records and My HR self-upload.
ALTER TABLE "EmployeeProfile" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
