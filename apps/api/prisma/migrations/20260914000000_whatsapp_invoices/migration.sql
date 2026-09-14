-- WhatsApp invoice delivery: after every in-store sale, send the customer a
-- WhatsApp message with a link to their invoice (apps/api's new public
-- /invoices/:orderId page). templateName/templateLanguage are editable
-- settings, not hardcoded, so swapping the sandbox test template for the
-- real approved one later is a settings change, not a code change.
CREATE TABLE "whatsapp_integrations" (
    "id" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "wabaId" TEXT NOT NULL,
    "accessTokenCipher" TEXT NOT NULL,
    "accessTokenIv" TEXT NOT NULL,
    "accessTokenTag" TEXT NOT NULL,
    "apiVersion" TEXT NOT NULL DEFAULT 'v21.0',
    "templateName" TEXT NOT NULL,
    "templateLanguage" TEXT NOT NULL DEFAULT 'ar',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_integrations_pkey" PRIMARY KEY ("id")
);

-- Per-order send attempts — SKIPPED covers "no customer/phone" and
-- "unrecognized phone format" so those are visible/debuggable, not silent.
CREATE TABLE "whatsapp_message_logs" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerPhone" TEXT,
    "status" TEXT NOT NULL,
    "templateName" TEXT,
    "whatsappMessageId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_message_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "whatsapp_message_logs_orderId_idx" ON "whatsapp_message_logs"("orderId");
ALTER TABLE "whatsapp_message_logs" ADD CONSTRAINT "whatsapp_message_logs_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
