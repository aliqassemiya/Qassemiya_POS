-- Read-cache: online (Shopify) orders, pulled from GET /sync/catalog (not
-- branch-scoped -- any till can receive a return for any online order),
-- never pushed.
CREATE TABLE IF NOT EXISTS shopify_order (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL,
  shopify_created_at TEXT NOT NULL,
  current_total_price REAL NOT NULL,
  currency TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shopify_order_order_number ON shopify_order(order_number);
CREATE INDEX IF NOT EXISTS idx_shopify_order_customer_phone ON shopify_order(customer_phone);

CREATE TABLE IF NOT EXISTS shopify_order_item (
  id TEXT PRIMARY KEY,
  shopify_order_id TEXT NOT NULL REFERENCES shopify_order(id),
  sku TEXT,
  title TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  line_total REAL NOT NULL,
  product_variant_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_shopify_order_item_order_id ON shopify_order_item(shopify_order_id);

-- Write-origin: an online order return logged at this branch. No refund
-- method/amount/restocked columns -- unlike "return" above, this never
-- touches inventory or the GL (see ShopifyReturnsService.createShopifyReturnTx).
CREATE TABLE IF NOT EXISTS shopify_return (
  id TEXT PRIMARY KEY,
  shopify_order_id TEXT NOT NULL REFERENCES shopify_order(id),
  branch_id TEXT NOT NULL,
  processed_by_user_id TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL,
  synced_at TEXT,
  sync_attempts INTEGER NOT NULL DEFAULT 0,
  last_sync_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_shopify_return_synced_at ON shopify_return(synced_at);
CREATE INDEX IF NOT EXISTS idx_shopify_return_order_id ON shopify_return(shopify_order_id);

CREATE TABLE IF NOT EXISTS shopify_return_item (
  id TEXT PRIMARY KEY,
  shopify_return_id TEXT NOT NULL REFERENCES shopify_return(id),
  shopify_order_item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shopify_return_item_return_id ON shopify_return_item(shopify_return_id);
