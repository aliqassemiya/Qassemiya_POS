-- CreateTable
CREATE TABLE "shopify_returns" (
    "id" TEXT NOT NULL,
    "shopifyOrderId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "processedByUserId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopify_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopify_return_items" (
    "id" TEXT NOT NULL,
    "shopifyReturnId" TEXT NOT NULL,
    "shopifyOrderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "shopify_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shopify_returns_shopifyOrderId_idx" ON "shopify_returns"("shopifyOrderId");

-- CreateIndex
CREATE INDEX "shopify_returns_branchId_idx" ON "shopify_returns"("branchId");

-- CreateIndex
CREATE INDEX "shopify_return_items_shopifyReturnId_idx" ON "shopify_return_items"("shopifyReturnId");

-- CreateIndex
CREATE INDEX "shopify_return_items_shopifyOrderItemId_idx" ON "shopify_return_items"("shopifyOrderItemId");

-- AddForeignKey
ALTER TABLE "shopify_returns" ADD CONSTRAINT "shopify_returns_shopifyOrderId_fkey" FOREIGN KEY ("shopifyOrderId") REFERENCES "shopify_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopify_returns" ADD CONSTRAINT "shopify_returns_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopify_returns" ADD CONSTRAINT "shopify_returns_processedByUserId_fkey" FOREIGN KEY ("processedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopify_return_items" ADD CONSTRAINT "shopify_return_items_shopifyReturnId_fkey" FOREIGN KEY ("shopifyReturnId") REFERENCES "shopify_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopify_return_items" ADD CONSTRAINT "shopify_return_items_shopifyOrderItemId_fkey" FOREIGN KEY ("shopifyOrderItemId") REFERENCES "shopify_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
