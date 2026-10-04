import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { createSaleSchema } from "@qassemiya/shared-types";

export class CreateSaleDto extends createZodDto(createSaleSchema) {}

export const salesListQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  cashierUserId: z.string().uuid().optional(),
  soldByEmployeeId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  paymentMethodId: z.string().uuid().optional(),
  // Plain "YYYY-MM-DD" -- what every <input type="date"> in the web app
  // actually sends; not a full ISO datetime string.
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  // Matches the order number shown in the UI (the id's first 8 chars, e.g.
  // "a1b2c3d4") OR any line item's SKU.
  search: z.string().trim().optional(),
  // Comma-separated order ids -- lets the POS batch-fetch orderNumber for a
  // page of already-synced local orders in one request (see the till's
  // backfillOrderNumbers, which catches up orders that finished syncing
  // before the sequential-order-number feature existed to record it).
  ids: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(50),
});
export class SalesListQueryDto extends createZodDto(salesListQuerySchema) {}

export const voidSaleSchema = z.object({
  reason: z.string().optional(),
});
export class VoidSaleDto extends createZodDto(voidSaleSchema) {}
