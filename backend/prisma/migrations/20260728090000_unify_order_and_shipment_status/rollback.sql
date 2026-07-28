-- Manual rollback for 20260728090000_unify_order_and_shipment_status.
BEGIN;

CREATE TYPE "ShipmentStatus" AS ENUM ('READY', 'SHIPPED', 'DELIVERED');
ALTER TABLE "shipments"
  ADD COLUMN "shipment_status" "ShipmentStatus" NOT NULL DEFAULT 'READY';
UPDATE "shipments" AS shipment
SET "shipment_status" = CASE orders."order_status"::text
  WHEN 'SHIPPED' THEN 'SHIPPED'::"ShipmentStatus"
  WHEN 'DELIVERED' THEN 'DELIVERED'::"ShipmentStatus"
  ELSE 'READY'::"ShipmentStatus"
END
FROM "orders"
WHERE orders."id" = shipment."order_id";
CREATE INDEX "idx_shipments_status" ON "shipments"("shipment_status");

CREATE TYPE "OrderStatus_old" AS ENUM (
  'PENDING_PAYMENT', 'PAYMENT_REQUESTED', 'PAYMENT_CONFIRMED', 'PREPARING',
  'SHIPPED', 'DELIVERED', 'CANCELLED', 'EXPIRED'
);
ALTER TABLE "orders" ALTER COLUMN "order_status" DROP DEFAULT;
ALTER TABLE "orders" ALTER COLUMN "order_status" TYPE "OrderStatus_old"
  USING ("order_status"::text::"OrderStatus_old");
ALTER TABLE "orders" ALTER COLUMN "order_status" SET DEFAULT 'PENDING_PAYMENT';
ALTER TABLE "order_status_histories" ALTER COLUMN "previous_status" TYPE "OrderStatus_old"
  USING ("previous_status"::text::"OrderStatus_old");
ALTER TABLE "order_status_histories" ALTER COLUMN "new_status" TYPE "OrderStatus_old"
  USING ("new_status"::text::"OrderStatus_old");
DROP TYPE "OrderStatus";
ALTER TYPE "OrderStatus_old" RENAME TO "OrderStatus";

COMMIT;
