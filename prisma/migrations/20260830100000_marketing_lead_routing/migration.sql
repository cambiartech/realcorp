-- CreateEnum
CREATE TYPE "MarketingLeadRouting" AS ENUM ('SALES_IMMEDIATE', 'MARKETING_HOLD');

-- AlterTable
ALTER TABLE "TenantSettings"
ADD COLUMN "marketingLeadRouting" "MarketingLeadRouting" NOT NULL DEFAULT 'SALES_IMMEDIATE';

-- AlterTable
ALTER TABLE "Lead"
ADD COLUMN "salesVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "salesReleasedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Lead_tenantId_salesVisible_idx" ON "Lead"("tenantId", "salesVisible");
