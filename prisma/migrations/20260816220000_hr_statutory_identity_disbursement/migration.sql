-- Statutory filing identity on employee records
ALTER TABLE "EmployeeProfile" ADD COLUMN "rsaPin" TEXT;
ALTER TABLE "EmployeeProfile" ADD COLUMN "pensionAdministrator" TEXT;
ALTER TABLE "EmployeeProfile" ADD COLUMN "nhfMembershipNumber" TEXT;

-- Reserved settlement columns on payslips (manual mark-paid remains the product path)
ALTER TABLE "HrPayslip" ADD COLUMN "disbursementChannel" TEXT DEFAULT 'MANUAL';
ALTER TABLE "HrPayslip" ADD COLUMN "disbursementBatchId" TEXT;
ALTER TABLE "HrPayslip" ADD COLUMN "disbursementStatus" TEXT;
