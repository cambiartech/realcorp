-- Ordinary marketing members (not department leads).
ALTER TYPE "MembershipRole" ADD VALUE IF NOT EXISTS 'MARKETING_EXECUTIVE';
