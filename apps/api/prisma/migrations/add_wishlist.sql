-- Add the `wishlists` table: a student's saved list of courses.
--
-- Tenant-owned like every other scoped model: it carries a denormalized
-- `tenant_id` so the Prisma tenant-scoping extension can inject
-- `where: { tenantId }` without join logic (see
-- src/prisma/tenant-scoping.extension.ts). The default 0 is only a
-- TypeScript-ergonomics shim; the extension always overwrites it.
--
-- A wishlist entry is unique per (user, course) pair. Both relations
-- cascade on delete: removing a user or a course removes its wishlist rows.

CREATE TABLE IF NOT EXISTS "wishlists" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL DEFAULT 0,
    "user_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "wishlists_user_id_course_id_key" ON "wishlists"("user_id", "course_id");
CREATE INDEX IF NOT EXISTS "wishlists_tenant_id_idx" ON "wishlists"("tenant_id");
CREATE INDEX IF NOT EXISTS "wishlists_user_id_idx" ON "wishlists"("user_id");
CREATE INDEX IF NOT EXISTS "wishlists_course_id_idx" ON "wishlists"("course_id");

-- The foreign keys are added conditionally so this file can be re-applied
-- safely on a database that already has the `wishlists` table.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.wishlists'::regclass
          AND conname = 'wishlists_user_id_fkey'
    ) THEN
        ALTER TABLE "wishlists"
            ADD CONSTRAINT "wishlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.wishlists'::regclass
          AND conname = 'wishlists_course_id_fkey'
    ) THEN
        ALTER TABLE "wishlists"
            ADD CONSTRAINT "wishlists_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
