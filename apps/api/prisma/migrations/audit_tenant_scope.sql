-- Tenant scope for the audit trail.
--
-- Each white-label workspace's admin sees only their own activity
-- (tenant_id = their workspace). Super admins see everything, including
-- platform-level events (tenant_id IS NULL) like tenant creation or
-- reseller payouts.
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "tenant_id" INT;
CREATE INDEX IF NOT EXISTS "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");
