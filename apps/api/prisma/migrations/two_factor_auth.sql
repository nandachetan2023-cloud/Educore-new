-- Add optional TOTP two-factor authentication columns.

ALTER TABLE "admins"
    ADD COLUMN IF NOT EXISTS "two_factor_secret" TEXT,
    ADD COLUMN IF NOT EXISTS "two_factor_enabled" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "two_factor_secret" TEXT,
    ADD COLUMN IF NOT EXISTS "two_factor_enabled" BOOLEAN NOT NULL DEFAULT FALSE;
