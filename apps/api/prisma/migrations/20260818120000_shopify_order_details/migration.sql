-- Order-detail breakdown (subtotal/discount/shipping/tax/paid) and customer
-- contact info, requested so the Online Orders page can show the same level
-- of detail as Shopify's own order view. Customer name/phone deliberately
-- were NOT captured in the original migration (pure sales-comparison scope
-- at the time) — the user has since asked for it explicitly, so it's added
-- here as plain columns rather than left buried in rawPayload.
ALTER TABLE "shopify_orders" ADD COLUMN "subtotalPrice" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "shopify_orders" ADD COLUMN "totalDiscounts" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "shopify_orders" ADD COLUMN "discountCodes" TEXT;
ALTER TABLE "shopify_orders" ADD COLUMN "totalShipping" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "shopify_orders" ADD COLUMN "shippingTitle" TEXT;
ALTER TABLE "shopify_orders" ADD COLUMN "totalTax" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "shopify_orders" ADD COLUMN "taxRate" DECIMAL(5,4);
ALTER TABLE "shopify_orders" ADD COLUMN "taxesIncluded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "shopify_orders" ADD COLUMN "totalOutstanding" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "shopify_orders" ADD COLUMN "customerName" TEXT;
ALTER TABLE "shopify_orders" ADD COLUMN "customerPhone" TEXT;
ALTER TABLE "shopify_orders" ADD COLUMN "customerEmail" TEXT;
