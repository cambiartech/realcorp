-- Employee self-service record edits wait here until HR approves them.
ALTER TABLE "EmployeeProfile" ADD COLUMN IF NOT EXISTS "pendingProfileUpdate" JSONB;
