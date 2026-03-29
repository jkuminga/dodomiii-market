CREATE TABLE "custom_order_links" (
    "custom_order_link_id" BIGSERIAL NOT NULL,
    "token" VARCHAR(80) NOT NULL,
    "product_name" VARCHAR(150) NOT NULL,
    "note" VARCHAR(500),
    "total_product_price" INTEGER NOT NULL DEFAULT 0,
    "shipping_fee" INTEGER NOT NULL DEFAULT 0,
    "final_total_price" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "used_order_id" BIGINT,
    "created_by_admin_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "custom_order_links_pkey" PRIMARY KEY ("custom_order_link_id")
);

CREATE UNIQUE INDEX "custom_order_links_token_key" ON "custom_order_links"("token");
CREATE UNIQUE INDEX "custom_order_links_used_order_id_key" ON "custom_order_links"("used_order_id");
CREATE INDEX "idx_custom_order_links_expires_at" ON "custom_order_links"("expires_at");
CREATE INDEX "idx_custom_order_links_active_deleted" ON "custom_order_links"("is_active", "deleted_at");
CREATE INDEX "idx_custom_order_links_created_by_admin_id" ON "custom_order_links"("created_by_admin_id");

ALTER TABLE "custom_order_links"
ADD CONSTRAINT "custom_order_links_used_order_id_fkey"
FOREIGN KEY ("used_order_id") REFERENCES "orders"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "custom_order_links"
ADD CONSTRAINT "custom_order_links_created_by_admin_id_fkey"
FOREIGN KEY ("created_by_admin_id") REFERENCES "admins"("admin_id")
ON DELETE SET NULL
ON UPDATE CASCADE;
