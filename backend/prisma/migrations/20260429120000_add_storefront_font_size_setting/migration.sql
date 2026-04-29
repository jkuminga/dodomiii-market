CREATE TYPE "UserWebFontSize" AS ENUM ('VERY_SMALL', 'SMALL', 'NORMAL', 'LARGE', 'VERY_LARGE');

CREATE TABLE "storefront_settings" (
  "key" VARCHAR(30) NOT NULL DEFAULT 'default',
  "user_web_font_size" "UserWebFontSize" NOT NULL DEFAULT 'NORMAL',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "storefront_settings_pkey" PRIMARY KEY ("key")
);

INSERT INTO "storefront_settings" ("key", "user_web_font_size")
VALUES ('default', 'NORMAL')
ON CONFLICT ("key") DO NOTHING;
