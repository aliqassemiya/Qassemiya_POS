-- Employees can now exist with no system access at all (sales-attribution
-- only), so pinCodeHash must become nullable; email is new record-keeping
-- data, unrelated to login.
ALTER TABLE "employees" ADD COLUMN "email" TEXT;
ALTER TABLE "employees" ALTER COLUMN "pinCodeHash" DROP NOT NULL;

-- Which employee a sale is attributed to, independent of who was logged
-- into the till.
ALTER TABLE "orders" ADD COLUMN "soldByEmployeeId" TEXT;
ALTER TABLE "orders" ADD CONSTRAINT "orders_soldByEmployeeId_fkey"
  FOREIGN KEY ("soldByEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "orders_soldByEmployeeId_idx" ON "orders"("soldByEmployeeId");
