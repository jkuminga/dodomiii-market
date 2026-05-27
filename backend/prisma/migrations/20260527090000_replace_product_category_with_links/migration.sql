CREATE TABLE "product_categories" (
    "product_id" BIGINT NOT NULL,
    "category_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("product_id", "category_id")
);

INSERT INTO "product_categories" ("product_id", "category_id")
SELECT "id", "category_id"
FROM "products";

CREATE INDEX "idx_product_categories_category_product"
ON "product_categories" ("category_id", "product_id");

ALTER TABLE "product_categories"
ADD CONSTRAINT "product_categories_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_categories"
ADD CONSTRAINT "product_categories_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "categories"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX IF EXISTS "idx_products_category_id";
DROP INDEX IF EXISTS "idx_products_category_visible_deleted_created";

ALTER TABLE "products"
DROP CONSTRAINT IF EXISTS "products_category_id_fkey";

ALTER TABLE "products"
DROP COLUMN "category_id";
