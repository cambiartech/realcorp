ALTER TABLE "ShortletUnit"
  ADD COLUMN IF NOT EXISTS "projectUnitId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ShortletUnit_projectUnitId_key" ON "ShortletUnit"("projectUnitId");

DO $$ BEGIN
  ALTER TABLE "ShortletUnit"
    ADD CONSTRAINT "ShortletUnit_projectUnitId_fkey"
    FOREIGN KEY ("projectUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
