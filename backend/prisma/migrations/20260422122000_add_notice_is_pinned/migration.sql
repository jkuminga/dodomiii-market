ALTER TABLE "notices"
ADD COLUMN IF NOT EXISTS "is_pinned" BOOLEAN NOT NULL DEFAULT false;

DROP INDEX IF EXISTS "idx_notices_published";

CREATE INDEX IF NOT EXISTS "idx_notices_pinned_published"
ON "notices"("is_pinned", "is_published", "published_at" DESC, "id" DESC);
