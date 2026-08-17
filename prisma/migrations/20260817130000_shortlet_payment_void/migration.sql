-- Removed short-let payments stay in Audit log only and must not count as collections.
ALTER TABLE "ShortletPayment" ADD COLUMN "voidedAt" TIMESTAMP(3);
CREATE INDEX "ShortletPayment_tenantId_voidedAt_idx" ON "ShortletPayment"("tenantId", "voidedAt");
