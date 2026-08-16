-- Product image moves from variant-level to product-level, matching the
-- server schema — a whole style (dress) is one image, not one per SKU.
ALTER TABLE product ADD COLUMN image_url TEXT;
ALTER TABLE product_variant DROP COLUMN image_url;
