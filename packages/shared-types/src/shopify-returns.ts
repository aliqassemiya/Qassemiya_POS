import { z } from "zod";

// Return of an ONLINE (Shopify) order processed at a branch till. Deliberately
// has no refundPaymentMethodId/refundAmount/restocked — unlike an in-store
// return (see createReturnSchema in ./sales), this never touches inventory or
// the GL; it's purely a log of what was physically handed back, where, by
// whom, and why. The actual refund happens in Shopify itself.
export const createShopifyReturnItemSchema = z.object({
  shopifyOrderItemId: z.string().uuid(),
  quantity: z.number().int().positive(),
});
export type CreateShopifyReturnItemInput = z.infer<typeof createShopifyReturnItemSchema>;

export const createShopifyReturnSchema = z.object({
  id: z.string().uuid(),
  shopifyOrderId: z.string().uuid(),
  branchId: z.string().uuid(),
  processedByUserId: z.string().uuid(),
  reason: z.string().optional(),
  items: z.array(createShopifyReturnItemSchema).min(1),
});
export type CreateShopifyReturnInput = z.infer<typeof createShopifyReturnSchema>;
