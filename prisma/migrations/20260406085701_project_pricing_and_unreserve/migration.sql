-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "basePrice" DECIMAL(18,2),
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'NGN';

-- CreateTable
CREATE TABLE "ProjectPricingPlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "initialDeposit" DECIMAL(18,2),
    "paymentDurationMonths" INTEGER,
    "billingCadence" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectPricingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectPricingPlan_tenantId_idx" ON "ProjectPricingPlan"("tenantId");

-- CreateIndex
CREATE INDEX "ProjectPricingPlan_projectId_idx" ON "ProjectPricingPlan"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectPricingPlan" ADD CONSTRAINT "ProjectPricingPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPricingPlan" ADD CONSTRAINT "ProjectPricingPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
