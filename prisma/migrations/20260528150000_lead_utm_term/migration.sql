-- Persist full UTM set (including utm_term) on leads from capture forms

ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "utmTerm" TEXT;
