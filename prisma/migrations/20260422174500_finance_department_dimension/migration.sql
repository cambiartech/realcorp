ALTER TABLE "Invoice"
ADD COLUMN "department" TEXT;

ALTER TABLE "PaymentRecord"
ADD COLUMN "department" TEXT;

ALTER TABLE "Expense"
ADD COLUMN "department" TEXT;
