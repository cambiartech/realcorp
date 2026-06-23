-- Link property clients to portal user accounts after invite acceptance.
ALTER TABLE "PropertyClient" ADD COLUMN "userId" TEXT;

CREATE INDEX "PropertyClient_tenantId_email_idx" ON "PropertyClient"("tenantId", "email");
CREATE INDEX "PropertyClient_userId_idx" ON "PropertyClient"("userId");

ALTER TABLE "PropertyClient" ADD CONSTRAINT "PropertyClient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
