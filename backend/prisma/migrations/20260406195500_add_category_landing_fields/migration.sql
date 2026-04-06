ALTER TABLE "categories"
  ADD COLUMN "image_url" VARCHAR(500),
  ADD COLUMN "is_on_landing_page" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "idx_categories_is_on_landing_page" ON "categories"("is_on_landing_page");
