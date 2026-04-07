-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "pricingPlanId" TEXT;

-- CreateIndex
CREATE INDEX "Unit_pricingPlanId_idx" ON "Unit"("pricingPlanId");

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_pricingPlanId_fkey" FOREIGN KEY ("pricingPlanId") REFERENCES "ProjectPricingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
