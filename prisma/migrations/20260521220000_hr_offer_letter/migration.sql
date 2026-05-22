CREATE TYPE "HrOfferLetterStatus" AS ENUM ('DRAFT', 'AWAITING_SIGNATURE', 'SIGNED');

CREATE TABLE "HrOfferLetter" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeProfileId" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "status" "HrOfferLetterStatus" NOT NULL DEFAULT 'DRAFT',
    "token" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "candidateSignature" TEXT,
    "candidateSignedAt" TIMESTAMP(3),
    "signedSnapshotUrl" TEXT,
    "lastEditedByUserId" TEXT,
    "lastEditedByLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrOfferLetter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HrOfferLetter_employeeProfileId_key" ON "HrOfferLetter"("employeeProfileId");
CREATE UNIQUE INDEX "HrOfferLetter_token_key" ON "HrOfferLetter"("token");
CREATE INDEX "HrOfferLetter_tenantId_status_idx" ON "HrOfferLetter"("tenantId", "status");
CREATE INDEX "HrOfferLetter_token_idx" ON "HrOfferLetter"("token");

ALTER TABLE "HrOfferLetter" ADD CONSTRAINT "HrOfferLetter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HrOfferLetter" ADD CONSTRAINT "HrOfferLetter_employeeProfileId_fkey" FOREIGN KEY ("employeeProfileId") REFERENCES "EmployeeProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
