CREATE TYPE "ShippingRegion" AS ENUM ('NORMAL', 'JEJU', 'ISLAND');

CREATE TABLE "shipping_settings" (
  "key" VARCHAR(30) NOT NULL DEFAULT 'default',
  "base_shipping_fee" INTEGER NOT NULL DEFAULT 3000,
  "jeju_additional_fee" INTEGER NOT NULL DEFAULT 3000,
  "island_additional_fee" INTEGER NOT NULL DEFAULT 5000,
  "free_shipping_enabled" BOOLEAN NOT NULL DEFAULT true,
  "free_shipping_threshold" INTEGER NOT NULL DEFAULT 10000,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "shipping_settings_pkey" PRIMARY KEY ("key")
);

INSERT INTO "shipping_settings" (
  "key",
  "base_shipping_fee",
  "jeju_additional_fee",
  "island_additional_fee",
  "free_shipping_enabled",
  "free_shipping_threshold"
)
VALUES ('default', 3000, 3000, 5000, true, 10000)
ON CONFLICT ("key") DO NOTHING;

ALTER TABLE "orders"
ADD COLUMN "shipping_region" "ShippingRegion" NOT NULL DEFAULT 'NORMAL';

ALTER TABLE "order_contacts"
ADD COLUMN "is_remote_area" BOOLEAN NOT NULL DEFAULT false;
