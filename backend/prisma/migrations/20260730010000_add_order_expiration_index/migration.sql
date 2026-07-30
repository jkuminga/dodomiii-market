CREATE INDEX "idx_orders_status_deposit_deadline"
ON "orders"("order_status", "deposit_deadline_at");
