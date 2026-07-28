-- Consolidate order and shipping stages into OrderStatus.
-- PAYMENT_REQUESTED is retained only in historical data before this migration.
BEGIN;

-- Collapse the retired intermediate state in existing status histories.
DELETE FROM "order_status_histories" WHERE "new_status" = 'PAYMENT_REQUESTED';
UPDATE "order_status_histories"
SET "previous_status" = 'PENDING_PAYMENT'
WHERE "previous_status" = 'PAYMENT_REQUESTED';

UPDATE "orders"
SET "order_status" = 'PENDING_PAYMENT'
WHERE "order_status" = 'PAYMENT_REQUESTED';

CREATE TYPE "OrderStatus_new" AS ENUM (
  'PENDING_PAYMENT',
  'PAYMENT_CONFIRMED',
  'PREPARING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'EXPIRED'
);

ALTER TABLE "orders" ALTER COLUMN "order_status" DROP DEFAULT;
ALTER TABLE "orders"
  ALTER COLUMN "order_status" TYPE "OrderStatus_new"
  USING ("order_status"::text::"OrderStatus_new");
ALTER TABLE "orders" ALTER COLUMN "order_status" SET DEFAULT 'PENDING_PAYMENT';
ALTER TABLE "order_status_histories"
  ALTER COLUMN "previous_status" TYPE "OrderStatus_new"
  USING ("previous_status"::text::"OrderStatus_new");
ALTER TABLE "order_status_histories"
  ALTER COLUMN "new_status" TYPE "OrderStatus_new"
  USING ("new_status"::text::"OrderStatus_new");
DROP TYPE "OrderStatus";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";

DROP INDEX IF EXISTS "idx_shipments_status";
ALTER TABLE "shipments" DROP COLUMN "shipment_status";
DROP TYPE "ShipmentStatus";

COMMIT;
