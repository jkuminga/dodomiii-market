CREATE TABLE "home_new_arrival_items" (
  "id" BIGSERIAL NOT NULL,
  "product_id" BIGINT NOT NULL,
  "image_url" VARCHAR(500) NOT NULL,
  "title" VARCHAR(100),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "home_new_arrival_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "home_new_arrival_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "idx_home_new_arrivals_active_sort"
ON "home_new_arrival_items"("is_active", "sort_order", "id");

CREATE INDEX "idx_home_new_arrivals_product_id"
ON "home_new_arrival_items"("product_id");

ALTER TABLE "home_new_arrival_items" ENABLE ROW LEVEL SECURITY;
