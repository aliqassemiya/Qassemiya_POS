-- Reorder-point / low-stock alerting is removed per client request.
ALTER TABLE "product_variants" DROP COLUMN "reorderPoint";
