-- Token revocation counters and provider order IDs for payment verification.
ALTER TABLE "admins"
  ADD COLUMN IF NOT EXISTS "token_version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "token_version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "provider_order_id" TEXT;
