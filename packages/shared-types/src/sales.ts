import { z } from "zod";
import { OrderSource, PaymentStatus } from "./enums";

export const saleItemSchema = z.object({
  // Client-generated (matches Order.id's own convention) so a return created
  // offline — which references orderItemId — can always resolve to the
  // exact same row once the sale has synced, instead of racing a
  // server-assigned id it has no way to learn in advance.
  id: z.string().uuid(),
  productVariantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  discountAmount: z.number().nonnegative().default(0),
  taxAmount: z.number().nonnegative().default(0),
  lineTotal: z.number().nonnegative(),
  costPriceSnapshot: z.number().nonnegative(),
});
export type SaleItemInput = z.infer<typeof saleItemSchema>;

export const salePaymentSchema = z.object({
  paymentMethodId: z.string().uuid(),
  amount: z.number().positive(),
  referenceNumber: z.string().optional(),
  // PENDING for BNPL methods (Tamara/Tabby) awaiting manual confirmation;
  // every other caller omits this and gets the normal instant-COMPLETED
  // behavior unchanged.
  status: z.nativeEnum(PaymentStatus).default(PaymentStatus.COMPLETED),
});
export type SalePaymentInput = z.infer<typeof salePaymentSchema>;

export const createSaleSchema = z.object({
  id: z.string().uuid(),
  branchId: z.string().uuid(),
  cashierUserId: z.string().uuid(),
  // Who gets credit for the sale — independent of cashierUserId (who was
  // actually logged into the till). Optional: not every sale needs a
  // specific salesperson picked.
  soldByEmployeeId: z.string().uuid().optional().nullable(),
  customerId: z.string().uuid().optional().nullable(),
  source: z.nativeEnum(OrderSource).default(OrderSource.ADMIN),
  items: z.array(saleItemSchema).min(1),
  payments: z.array(salePaymentSchema).min(1),
  subtotal: z.number().nonnegative(),
  discountTotal: z.number().nonnegative().default(0),
  taxTotal: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
  notes: z.string().optional(),
});
export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const returnItemSchema = z.object({
  orderItemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  refundAmount: z.number().nonnegative(),
  restocked: z.boolean().default(true),
});
export type ReturnItemInput = z.infer<typeof returnItemSchema>;

export const createReturnSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  branchId: z.string().uuid(),
  processedByUserId: z.string().uuid(),
  refundPaymentMethodId: z.string().uuid(),
  reason: z.string().optional(),
  items: z.array(returnItemSchema).min(1),
  totalRefundAmount: z.number().nonnegative(),
});
export type CreateReturnInput = z.infer<typeof createReturnSchema>;
