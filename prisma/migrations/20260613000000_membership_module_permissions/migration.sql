-- Per-user module access overrides (read / edit / full) independent of job role.
ALTER TABLE "Membership" ADD COLUMN "modulePermissions" JSONB;
