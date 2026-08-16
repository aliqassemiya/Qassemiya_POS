-- Qassemiya POS local schema (SQLite)
-- Read-cache tables (pulled from server via GET /sync/catalog, scoped to the paired branch)
-- + write-origin tables (created locally, pushed via POST /sync/push)
-- + local_meta key/value settings store.

CREATE TABLE IF NOT EXISTS local_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- ---------- read-cache ----------

CREATE TABLE IF NOT EXISTS category (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT,
  parent_id TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT,
  description TEXT,
  category_id TEXT,
  brand TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_variant (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  barcode TEXT,
  barcode_type TEXT,
  size TEXT,
  color TEXT,
  color_hex TEXT,
  cost_price REAL NOT NULL,
  selling_price REAL NOT NULL,
  compare_at_price REAL,
  tax_rate REAL NOT NULL DEFAULT 15,
  reorder_point INTEGER,
  image_url TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_product_variant_barcode ON product_variant(barcode);
CREATE INDEX IF NOT EXISTS idx_product_variant_sku ON product_variant(sku);
CREATE INDEX IF NOT EXISTS idx_product_variant_product_id ON product_variant(product_id);

CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  product_variant_id TEXT NOT NULL,
  quantity_on_hand INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE (branch_id, product_variant_id)
);

CREATE TABLE IF NOT EXISTS customer (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customer_phone ON customer(phone);

CREATE TABLE IF NOT EXISTS payment_method (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

-- ---------- write-origin ----------
-- syncedAt IS NULL means "not yet pushed to server". No separate outbox table:
-- Order.syncedAt is the sync cursor for the whole bundle (order + items + payments).
-- Return.syncedAt plays the same role for return bundles.

CREATE TABLE IF NOT EXISTS "order" (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  cashier_user_id TEXT NOT NULL,
  customer_id TEXT,
  source TEXT NOT NULL DEFAULT 'POS',
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  subtotal REAL NOT NULL,
  discount_total REAL NOT NULL DEFAULT 0,
  tax_total REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  synced_at TEXT,
  sync_attempts INTEGER NOT NULL DEFAULT 0,
  last_sync_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_order_synced_at ON "order"(synced_at);
CREATE INDEX IF NOT EXISTS idx_order_created_at ON "order"(created_at);

CREATE TABLE IF NOT EXISTS order_item (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES "order"(id),
  product_variant_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  discount_amount REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL,
  cost_price_snapshot REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_item_order_id ON order_item(order_id);

CREATE TABLE IF NOT EXISTS payment (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES "order"(id),
  payment_method_id TEXT NOT NULL,
  amount REAL NOT NULL,
  reference_number TEXT
);
CREATE INDEX IF NOT EXISTS idx_payment_order_id ON payment(order_id);

CREATE TABLE IF NOT EXISTS "return" (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES "order"(id),
  branch_id TEXT NOT NULL,
  processed_by_user_id TEXT NOT NULL,
  reason TEXT,
  total_refund_amount REAL NOT NULL,
  created_at TEXT NOT NULL,
  synced_at TEXT,
  sync_attempts INTEGER NOT NULL DEFAULT 0,
  last_sync_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_return_synced_at ON "return"(synced_at);
CREATE INDEX IF NOT EXISTS idx_return_order_id ON "return"(order_id);

CREATE TABLE IF NOT EXISTS return_item (
  id TEXT PRIMARY KEY,
  return_id TEXT NOT NULL REFERENCES "return"(id),
  order_item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  refund_amount REAL NOT NULL,
  restocked INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_return_item_return_id ON return_item(return_id);

-- Local audit ledger only (mirrors server StockMovement shape); the server derives
-- its own StockMovement rows from the synced sale/return bundle, so these rows are
-- never pushed over the wire — they exist purely to drive the local inventory cache
-- and give the till an immediate, offline-correct stock view.
CREATE TABLE IF NOT EXISTS stock_movement (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL,
  product_variant_id TEXT NOT NULL,
  quantity_change INTEGER NOT NULL,
  type TEXT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stock_movement_variant ON stock_movement(product_variant_id);
