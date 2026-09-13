-- Shopify order sync. Deliberately separate from "orders"/"order_items" —
-- Order.branchId/cashierUserId are NOT NULL and createSaleTx unconditionally
-- posts stock movements + GL journal entries, so reusing that table would
-- require a guard inside an already-complex transaction. These new tables
-- have no code path into stock_movements/inventory/journal_entries at all,
-- making "Shopify orders never touch inventory" true by construction.

CREATE TABLE "shopify_integrations" (
    "id" TEXT NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "accessTokenCipher" TEXT NOT NULL,
    "accessTokenIv" TEXT NOT NULL,
    "accessTokenTag" TEXT NOT NULL,
    "apiVersion" TEXT NOT NULL DEFAULT '2024-10',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "syncFromDate" TIMESTAMP(3) NOT NULL,
    "syncCursor" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopify_integrations_pkey" PRIMARY KEY ("id")
);

-- No branchId — online sales are company-wide, not branch-attributable.
-- No customer name/email/address — out of scope for a pure sales
-- comparison feature, avoids taking on PII exposure this doesn't need.
CREATE TABLE "shopify_orders" (
    "id" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "shopifyCreatedAt" TIMESTAMP(3) NOT NULL,
    "shopifyUpdatedAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "financialStatus" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "currentTotalPrice" DECIMAL(12,2) NOT NULL,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopify_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shopify_orders_shopifyOrderId_key" ON "shopify_orders"("shopifyOrderId");
CREATE INDEX "shopify_orders_shopifyUpdatedAt_idx" ON "shopify_orders"("shopifyUpdatedAt");

-- productVariantId is nullable by design: a sync must never fail or skip an
-- order just because its SKU doesn't exist in the POS catalog yet. sku/title
-- are kept raw regardless of match status so unmatched items stay reportable.
CREATE TABLE "shopify_order_items" (
    "id" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "sku" TEXT,
    "title" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "productVariantId" TEXT,

    CONSTRAINT "shopify_order_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "shopify_order_items_shopifyOrderId_idx" ON "shopify_order_items"("shopifyOrderId");
CREATE INDEX "shopify_order_items_productVariantId_idx" ON "shopify_order_items"("productVariantId");

ALTER TABLE "shopify_order_items" ADD CONSTRAINT "shopify_order_items_shopifyOrderId_fkey"
    FOREIGN KEY ("shopifyOrderId") REFERENCES "shopify_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shopify_order_items" ADD CONSTRAINT "shopify_order_items_productVariantId_fkey"
    FOREIGN KEY ("productVariantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- An IN_PROGRESS row doubles as the overlap lock between the cron tick and a
-- manual "Sync now" click (see shopify.service.ts runSync) — no separate
-- lock table needed.
CREATE TABLE "shopify_sync_logs" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "ordersFetched" INTEGER NOT NULL DEFAULT 0,
    "ordersUpserted" INTEGER NOT NULL DEFAULT 0,
    "cursorFrom" TIMESTAMP(3),
    "cursorTo" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "shopify_sync_logs_pkey" PRIMARY KEY ("id")
);
