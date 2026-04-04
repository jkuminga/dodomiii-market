CREATE TABLE "home_popups" (
  "id" BIGSERIAL NOT NULL,
  "title" VARCHAR(100),
  "image_url" VARCHAR(500) NOT NULL,
  "link_url" VARCHAR(500),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "home_popups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_home_popups_active_updated" ON "home_popups"("is_active", "updated_at");
