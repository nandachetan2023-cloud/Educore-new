-- Password reset tokens for users + admins
ALTER TABLE "admins"
  ADD COLUMN IF NOT EXISTS "password_reset_token" TEXT,
  ADD COLUMN IF NOT EXISTS "password_reset_expires" TIMESTAMP(3);

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "password_reset_token" TEXT,
  ADD COLUMN IF NOT EXISTS "password_reset_expires" TIMESTAMP(3);

-- Coupon approval workflow (admin creates -> superadmin approves)
ALTER TABLE "coupons"
  ADD COLUMN IF NOT EXISTS "approval_status" "ApproveStatus" NOT NULL DEFAULT 'pending';
