CREATE TYPE "ProductOptionSelectionType" AS ENUM ('SINGLE', 'QUANTITY');

CREATE TABLE "product_option_groups" (
    "id" BIGSERIAL NOT NULL,
    "product_id" BIGINT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "selection_type" "ProductOptionSelectionType" NOT NULL DEFAULT 'SINGLE',
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_option_groups_pkey" PRIMARY KEY ("id")
);

INSERT INTO "product_option_groups" (
    "product_id",
    "name",
    "selection_type",
    "is_required",
    "is_active",
    "sort_order",
    "created_at",
    "updated_at"
)
SELECT
    "product_id",
    "option_group_name",
    'SINGLE'::"ProductOptionSelectionType",
    false,
    bool_or("is_active"),
    MIN("sort_order"),
    MIN("created_at"),
    MAX("updated_at")
FROM "product_options"
GROUP BY "product_id", "option_group_name";

ALTER TABLE "product_options"
ADD COLUMN "option_group_id" BIGINT,
ADD COLUMN "max_quantity" INTEGER;

UPDATE "product_options" po
SET "option_group_id" = pog."id"
FROM "product_option_groups" pog
WHERE pog."product_id" = po."product_id"
  AND pog."name" = po."option_group_name";

ALTER TABLE "product_options"
ALTER COLUMN "option_group_id" SET NOT NULL;

ALTER TABLE "product_options"
DROP CONSTRAINT "product_options_product_id_fkey";

DROP INDEX "idx_product_options_product_active";

ALTER TABLE "product_options"
DROP COLUMN "product_id",
DROP COLUMN "option_group_name";

CREATE INDEX "idx_product_option_groups_product_active" ON "product_option_groups"("product_id", "is_active");
CREATE INDEX "idx_product_options_group_active" ON "product_options"("option_group_id", "is_active");

ALTER TABLE "product_options"
ADD CONSTRAINT "product_options_option_group_id_fkey"
FOREIGN KEY ("option_group_id") REFERENCES "product_option_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_option_groups"
ADD CONSTRAINT "product_option_groups_product_id_fkey"
FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_items"
ALTER COLUMN "option_value_snapshot" TYPE VARCHAR(255);

CREATE TABLE "order_item_option_selections" (
    "id" BIGSERIAL NOT NULL,
    "order_item_id" BIGINT NOT NULL,
    "product_option_group_id" BIGINT,
    "product_option_id" BIGINT,
    "group_name_snapshot" VARCHAR(100) NOT NULL,
    "option_name_snapshot" VARCHAR(100) NOT NULL,
    "extra_price_snapshot" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_option_selections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "idx_order_item_option_selections_order_item_id" ON "order_item_option_selections"("order_item_id");
CREATE INDEX "idx_order_item_option_selections_option_id" ON "order_item_option_selections"("product_option_id");

ALTER TABLE "order_item_option_selections"
ADD CONSTRAINT "order_item_option_selections_order_item_id_fkey"
FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_item_option_selections"
ADD CONSTRAINT "order_item_option_selections_product_option_group_id_fkey"
FOREIGN KEY ("product_option_group_id") REFERENCES "product_option_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_item_option_selections"
ADD CONSTRAINT "order_item_option_selections_product_option_id_fkey"
FOREIGN KEY ("product_option_id") REFERENCES "product_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;
