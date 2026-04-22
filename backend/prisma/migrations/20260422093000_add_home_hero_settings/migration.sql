CREATE TABLE "home_hero_settings" (
  "key" VARCHAR(30) NOT NULL DEFAULT 'default',
  "image_url" VARCHAR(500) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "home_hero_settings_pkey" PRIMARY KEY ("key")
);
