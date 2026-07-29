-- Department + lead flag (manager/coordinator toggle) on memberships and invites.
ALTER TABLE "Membership" ADD COLUMN "department" TEXT;
ALTER TABLE "Membership" ADD COLUMN "isDepartmentLead" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Invitation" ADD COLUMN "department" TEXT;
ALTER TABLE "Invitation" ADD COLUMN "isDepartmentLead" BOOLEAN NOT NULL DEFAULT false;

-- Backfill from legacy roles
UPDATE "Membership" SET department = 'sales', "isDepartmentLead" = true WHERE role = 'SALES_MANAGER';
UPDATE "Membership" SET department = 'sales', "isDepartmentLead" = false WHERE role = 'SALES_EXECUTIVE';
UPDATE "Membership" SET department = 'finance', "isDepartmentLead" = true WHERE role = 'FINANCE_MANAGER';
UPDATE "Membership" SET department = 'hr', "isDepartmentLead" = true WHERE role = 'HR_MANAGER';
UPDATE "Membership" SET department = 'marketing', "isDepartmentLead" = true WHERE role = 'MARKETING_MANAGER';
UPDATE "Membership" SET department = 'community', "isDepartmentLead" = true WHERE role = 'COMMUNITY_MANAGER';
UPDATE "Membership" SET department = 'operations', "isDepartmentLead" = true WHERE role = 'HOUSEKEEPING_MANAGER';
UPDATE "Membership" SET department = 'operations', "isDepartmentLead" = false WHERE role = 'FNB_STAFF';

UPDATE "Invitation" SET department = 'sales', "isDepartmentLead" = true WHERE role = 'SALES_MANAGER';
UPDATE "Invitation" SET department = 'sales', "isDepartmentLead" = false WHERE role = 'SALES_EXECUTIVE';
UPDATE "Invitation" SET department = 'finance', "isDepartmentLead" = true WHERE role = 'FINANCE_MANAGER';
UPDATE "Invitation" SET department = 'hr', "isDepartmentLead" = true WHERE role = 'HR_MANAGER';
UPDATE "Invitation" SET department = 'marketing', "isDepartmentLead" = true WHERE role = 'MARKETING_MANAGER';
UPDATE "Invitation" SET department = 'community', "isDepartmentLead" = true WHERE role = 'COMMUNITY_MANAGER';
UPDATE "Invitation" SET department = 'operations', "isDepartmentLead" = true WHERE role = 'HOUSEKEEPING_MANAGER';
UPDATE "Invitation" SET department = 'operations', "isDepartmentLead" = false WHERE role = 'FNB_STAFF';
