-- Link finance payments to a property client without creating a second ledger.
ALTER TABLE "PaymentRecord" ADD COLUMN "propertyClientId" TEXT;

CREATE INDEX "PaymentRecord_tenantId_propertyClientId_idx" ON "PaymentRecord"("tenantId", "propertyClientId");

ALTER TABLE "PaymentRecord" ADD CONSTRAINT "PaymentRecord_propertyClientId_fkey" FOREIGN KEY ("propertyClientId") REFERENCES "PropertyClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
