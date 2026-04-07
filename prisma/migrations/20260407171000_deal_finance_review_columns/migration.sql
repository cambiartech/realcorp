-- Backfill missing Deal finance review columns used by schema + seed.

ALTER TABLE "Deal"
  ADD COLUMN IF NOT EXISTS "financeDecision" "FinanceReviewDecision",
  ADD COLUMN IF NOT EXISTS "financeReviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "financeReviewedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "financeReviewedByLabel" TEXT;

