-- Per-client sale price so remaining balance can follow a promo or waived amount
-- instead of the brochure unit price.
ALTER TABLE "ClientUnitLink" ADD COLUMN "agreedPrice" DECIMAL(18,2);
ALTER TABLE "ClientUnitLink" ADD COLUMN "priceAdjustmentReason" TEXT;
ALTER TABLE "ClientUnitLink" ADD COLUMN "priceAdjustedAt" TIMESTAMP(3);
ALTER TABLE "ClientUnitLink" ADD COLUMN "priceAdjustedByUserId" TEXT;
