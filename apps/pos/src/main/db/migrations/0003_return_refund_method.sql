-- Returns now record which payment method the refund went out through, so
-- the server-side GL posting (Finance & Accounting module) knows which
-- account to credit. Nullable locally (any pre-existing unsynced return
-- created before this migration won't have one and simply can't sync until
-- reconciled) — the renderer always collects it going forward.
ALTER TABLE "return" ADD COLUMN refund_payment_method_id TEXT;
