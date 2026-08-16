-- Product image moves from variant-level to product-level: a whole style
-- (dress) is one image, not one per size/color SKU.

-- AlterTable
ALTER TABLE "products" ADD COLUMN "imageUrl" TEXT;

-- Backfill: carry forward each product's first non-null variant image
-- before the column is dropped, so no existing image is silently lost.
UPDATE "products" p
SET "imageUrl" = v."imageUrl"
FROM (
  SELECT DISTINCT ON ("productId") "productId", "imageUrl"
  FROM "product_variants"
  WHERE "imageUrl" IS NOT NULL
  ORDER BY "productId", "createdAt" ASC
) v
WHERE v."productId" = p.id;

-- AlterTable
ALTER TABLE "product_variants" DROP COLUMN "imageUrl";
