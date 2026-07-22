CREATE TYPE "HomeItemSection" AS ENUM ('NEW_ARRIVAL', 'BEST');

ALTER TABLE "home_new_arrival_items" RENAME TO "home_items";

ALTER TABLE "home_items" RENAME CONSTRAINT "home_new_arrival_items_pkey" TO "home_items_pkey";
ALTER TABLE "home_items" RENAME CONSTRAINT "home_new_arrival_items_product_id_fkey" TO "home_items_product_id_fkey";

ALTER TABLE "home_items"
  ADD COLUMN "section" "HomeItemSection" NOT NULL DEFAULT 'NEW_ARRIVAL',
  ALTER COLUMN "image_url" DROP NOT NULL;

ALTER TABLE "home_items" ALTER COLUMN "section" DROP DEFAULT;

DROP INDEX "idx_home_new_arrivals_active_sort";

ALTER INDEX "idx_home_new_arrivals_product_id" RENAME TO "idx_home_items_product_id";

CREATE UNIQUE INDEX "uq_home_items_section_product"
ON "home_items"("section", "product_id");

CREATE INDEX "idx_home_items_section_active_sort"
ON "home_items"("section", "is_active", "sort_order", "id");
