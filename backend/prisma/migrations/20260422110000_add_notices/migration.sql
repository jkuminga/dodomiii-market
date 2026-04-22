CREATE TABLE "notices" (
    "id" BIGSERIAL NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "summary" VARCHAR(500),
    "content_json" JSONB NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_notices_published" ON "notices"("is_published", "published_at" DESC, "id" DESC);
CREATE INDEX "idx_notices_deleted_created" ON "notices"("deleted_at", "created_at" DESC, "id" DESC);
