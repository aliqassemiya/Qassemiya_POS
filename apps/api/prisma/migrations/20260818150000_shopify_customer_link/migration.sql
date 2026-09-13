-- Links a Shopify order to the shared Customer table (matched by phone, the
-- existing unique identifier for customers in this system) so a person who
-- buys both online and in-store shows up as one customer, not two, and
-- appears in the existing Customers screen automatically.
ALTER TABLE "shopify_orders" ADD COLUMN "customerId" TEXT;
CREATE INDEX "shopify_orders_customerId_idx" ON "shopify_orders"("customerId");
ALTER TABLE "shopify_orders" ADD CONSTRAINT "shopify_orders_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
