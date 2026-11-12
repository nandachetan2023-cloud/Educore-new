-- Add course tagging: a `tags` table and the `course_tags` join table.
--
-- Tenant-owned like every other scoped model: both tables carry a
-- denormalized `tenant_id` so the Prisma tenant-scoping extension can inject
-- `where: { tenantId }` without join logic (see
-- src/prisma/tenant-scoping.extension.ts). The default 0 is only a
-- TypeScript-ergonomics shim; the extension always overwrites it.
--
-- A tag slug is unique per tenant (tags are created independently per
-- tenant, so the same slug may exist for two different tenants).
-- A course is tagged at most once per tag (unique on the join pair).
--
-- Both relations cascade on delete: removing a course (or a tag) removes the
-- corresponding `course_tags` rows.

CREATE TABLE IF NOT EXISTS "tags" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tags_tenant_id_slug_key" ON "tags"("tenant_id", "slug");
CREATE INDEX IF NOT EXISTS "tags_tenant_id_idx" ON "tags"("tenant_id");

CREATE TABLE IF NOT EXISTS "course_tags" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL DEFAULT 0,
    "course_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "course_tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "course_tags_course_id_tag_id_key" ON "course_tags"("course_id", "tag_id");
CREATE INDEX IF NOT EXISTS "course_tags_tenant_id_idx" ON "course_tags"("tenant_id");
CREATE INDEX IF NOT EXISTS "course_tags_tag_id_idx" ON "course_tags"("tag_id");

-- The foreign keys are added conditionally so this file can be re-applied
-- safely on a database that already has the `tags` / `course_tags` tables.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.course_tags'::regclass
          AND conname = 'course_tags_course_id_fkey'
    ) THEN
        ALTER TABLE "course_tags"
            ADD CONSTRAINT "course_tags_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.course_tags'::regclass
          AND conname = 'course_tags_tag_id_fkey'
    ) THEN
        ALTER TABLE "course_tags"
            ADD CONSTRAINT "course_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
