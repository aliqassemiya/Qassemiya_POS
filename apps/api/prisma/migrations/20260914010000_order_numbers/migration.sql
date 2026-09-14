-- Sequential, per-branch order numbers (branch.code + 8-digit zero-padded
-- counter, no separator, e.g. "20100000020"). Assigned atomically at order
-- creation via SalesService.createSaleTx. Existing orders are not
-- backfilled -- every branch starts fresh at 1 for its next sale.
CREATE TABLE "branch_order_sequences" (
    "branchId" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "branch_order_sequences_pkey" PRIMARY KEY ("branchId")
);

ALTER TABLE "branch_order_sequences" ADD CONSTRAINT "branch_order_sequences_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "orders" ADD COLUMN "orderNumber" TEXT;
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");
