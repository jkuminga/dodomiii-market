UPDATE "products" p
SET "content_json" = jsonb_build_object(
  'version', 1,
  'blocks',
  (
    COALESCE(
      CASE
        WHEN NULLIF(BTRIM(p."description"), '') IS NOT NULL
        THEN jsonb_build_array(jsonb_build_object('type', 'paragraph', 'text', BTRIM(p."description")))
        ELSE '[]'::jsonb
      END,
      '[]'::jsonb
    )
    ||
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'type', 'image',
            'imageUrl', pi."image_url",
            'publicId', NULL,
            'alt', NULL,
            'caption', NULL,
            'linkUrl', NULL,
            'align', 'center',
            'widthMode', 'content',
            'width', NULL,
            'height', NULL,
            'isCover', false
          )
          ORDER BY pi."sort_order", pi."id"
        )
        FROM "product_images" pi
        WHERE pi."product_id" = p."id"
          AND pi."image_type" = 'DETAIL'
      ),
      '[]'::jsonb
    )
  )
)
WHERE p."content_json" IS NULL
  AND (
    NULLIF(BTRIM(p."description"), '') IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM "product_images" pi
      WHERE pi."product_id" = p."id"
        AND pi."image_type" = 'DETAIL'
    )
  );

DELETE FROM "product_images"
WHERE "image_type" = 'DETAIL';

DROP INDEX IF EXISTS "idx_product_images_product_sort";

ALTER TABLE "product_images"
DROP COLUMN "image_type";

ALTER TABLE "product_images"
RENAME TO "product_thumbnails";

ALTER INDEX IF EXISTS "product_images_pkey"
RENAME TO "product_thumbnails_pkey";

CREATE INDEX "idx_product_thumbnails_product_sort"
ON "product_thumbnails" ("product_id", "sort_order");

DROP TYPE IF EXISTS "ProductImageType";
