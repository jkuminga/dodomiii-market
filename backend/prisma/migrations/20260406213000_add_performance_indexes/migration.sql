CREATE INDEX "idx_categories_slug" ON "categories"("slug");

CREATE INDEX "idx_categories_visible_sort" ON "categories"("is_visible", "sort_order", "id");

CREATE INDEX "idx_products_visible_deleted_created" ON "products"("is_visible", "deleted_at", "created_at" DESC, "id" DESC);

CREATE INDEX "idx_products_visible_deleted_price" ON "products"("is_visible", "deleted_at", "base_price", "id" DESC);

CREATE INDEX "idx_products_category_visible_deleted_created" ON "products"("category_id", "is_visible", "deleted_at", "created_at" DESC, "id" DESC);

CREATE INDEX "idx_orders_created_id_desc" ON "orders"("created_at" DESC, "id" DESC);
