-- Investor / Listing-owner portal (Phase 3)

-- New membership roles for portal-only accounts
ALTER TYPE "MembershipRole" ADD VALUE IF NOT EXISTS 'INVESTOR';
ALTER TYPE "MembershipRole" ADD VALUE IF NOT EXISTS 'LISTING_OWNER';

-- Stakeholder type
CREATE TYPE "StakeholderType" AS ENUM ('INVESTOR', 'LISTING_OWNER');

-- Link table: which user has a stake in which project
CREATE TABLE "ProjectStakeholder" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "StakeholderType" NOT NULL,
    "sharePercent" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "investmentAmount" DECIMAL(18,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectStakeholder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectStakeholder_projectId_userId_key" ON "ProjectStakeholder"("projectId", "userId");
CREATE INDEX "ProjectStakeholder_tenantId_userId_idx" ON "ProjectStakeholder"("tenantId", "userId");
CREATE INDEX "ProjectStakeholder_projectId_idx" ON "ProjectStakeholder"("projectId");

ALTER TABLE "ProjectStakeholder" ADD CONSTRAINT "ProjectStakeholder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectStakeholder" ADD CONSTRAINT "ProjectStakeholder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectStakeholder" ADD CONSTRAINT "ProjectStakeholder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
