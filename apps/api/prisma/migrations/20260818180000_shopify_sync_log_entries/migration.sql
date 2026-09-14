-- Per-run audit trail: which specific Shopify orders were touched (created
-- vs updated) by a given sync run, so the settings page's "Orders (upserted
-- / fetched)" figure can be drilled into instead of being just a count.
CREATE TABLE "shopify_sync_log_entries" (
    "id" TEXT NOT NULL,
    "syncLogId" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopify_sync_log_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "shopify_sync_log_entries_syncLogId_idx" ON "shopify_sync_log_entries"("syncLogId");
ALTER TABLE "shopify_sync_log_entries" ADD CONSTRAINT "shopify_sync_log_entries_syncLogId_fkey"
    FOREIGN KEY ("syncLogId") REFERENCES "shopify_sync_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shopify_sync_log_entries" ADD CONSTRAINT "shopify_sync_log_entries_shopifyOrderId_fkey"
    FOREIGN KEY ("shopifyOrderId") REFERENCES "shopify_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
