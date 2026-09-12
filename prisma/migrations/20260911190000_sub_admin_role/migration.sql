-- Subadmin: org-wide operator without People / payroll access.
ALTER TYPE "MembershipRole" ADD VALUE IF NOT EXISTS 'SUB_ADMIN';
