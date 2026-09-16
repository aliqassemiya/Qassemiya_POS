-- Tabby BNPL: same in-store, manually-confirmed pattern as Tamara.
CREATE TABLE "tabby_integrations" (
    "id" TEXT NOT NULL,
    "secretKeyCipher" TEXT NOT NULL,
    "secretKeyIv" TEXT NOT NULL,
    "secretKeyTag" TEXT NOT NULL,
    "merchantCode" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'KSA',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tabby_integrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tabby_checkout_logs" (
    "id" TEXT NOT NULL,
    "orderReferenceId" TEXT NOT NULL,
    "sessionId" TEXT,
    "paymentId" TEXT,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tabby_checkout_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tabby_checkout_logs_orderReferenceId_idx" ON "tabby_checkout_logs"("orderReferenceId");
