-- Page builder: custom pages can be composed from structured blocks instead
-- of a single HTML blob. `content` stays for pages authored before the
-- builder (and as an HTML fallback). SEO fields let the public page render
-- its own title/description instead of reusing the page title.

ALTER TABLE "custom_pages"
    ADD COLUMN IF NOT EXISTS "blocks" JSONB,
    ADD COLUMN IF NOT EXISTS "seo_title" TEXT,
    ADD COLUMN IF NOT EXISTS "seo_description" TEXT;
