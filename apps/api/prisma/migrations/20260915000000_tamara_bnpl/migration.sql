-- Tamara BNPL: in-store checkout sessions created live at the till, payment
-- confirmed manually by staff later (no webhook automation in this pass).
CREATE TABLE "tamara_integrations" (
    "id" TEXT NOT NULL,
    "apiKeyCipher" TEXT NOT NULL,
    "apiKeyIv" TEXT NOT NULL,
    "apiKeyTag" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'sandbox',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tamara_integrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tamara_checkout_logs" (
    "id" TEXT NOT NULL,
    "orderReferenceId" TEXT NOT NULL,
    "checkoutId" TEXT,
    "tamaraOrderId" TEXT,
    "checkoutDeeplink" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tamara_checkout_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tamara_checkout_logs_orderReferenceId_idx" ON "tamara_checkout_logs"("orderReferenceId");
