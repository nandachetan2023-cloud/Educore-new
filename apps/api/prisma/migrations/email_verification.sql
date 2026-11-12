-- Email verification tokens for users + admins.
--
-- The token is a short-lived opaque string emailed to the account owner; the
-- expiry column stores its absolute expiration time. Both are nullable because
-- accounts that are already verified (or were created before this feature) have
-- no pending verification. TIMESTAMP(3) matches the precision Prisma uses for
-- DateTime on PostgreSQL.

ALTER TABLE "admins"
  ADD COLUMN IF NOT EXISTS "email_verify_token" TEXT,
  ADD COLUMN IF NOT EXISTS "email_verify_expires" TIMESTAMP(3);

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "email_verify_token" TEXT,
  ADD COLUMN IF NOT EXISTS "email_verify_expires" TIMESTAMP(3);
