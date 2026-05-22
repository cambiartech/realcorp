ALTER TABLE "TenantSettings"
ADD COLUMN "financeBankAccounts" JSONB,
ADD COLUMN "financePaymentModes" JSONB,
ADD COLUMN "financeCurrencies" JSONB;
