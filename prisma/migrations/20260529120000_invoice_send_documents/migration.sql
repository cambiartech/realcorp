-- Invoice email send + finance document link

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "pdfUrl" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "sentToEmail" TEXT;

ALTER TABLE "FinanceDocument" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "FinanceDocument_invoiceId_key" ON "FinanceDocument"("invoiceId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FinanceDocument_invoiceId_fkey'
  ) THEN
    ALTER TABLE "FinanceDocument"
      ADD CONSTRAINT "FinanceDocument_invoiceId_fkey"
      FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
