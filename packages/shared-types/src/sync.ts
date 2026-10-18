import { z } from "zod";
import { createSaleSchema, createReturnSchema } from "./sales";
import { createShopifyReturnSchema } from "./shopify-returns";
import { SyncBundleStatus } from "./enums";

/**
 * A sync bundle is exactly one offline-created sale, in-store return, or
 * online-order return, carrying every row it needs so the server can
 * upsert-by-id inside a single transaction. The bundle id IS the idempotency key.
 */
export const syncBundleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("SALE"), clientCreatedAt: z.string().datetime(), payload: createSaleSchema }),
  z.object({ kind: z.literal("RETURN"), clientCreatedAt: z.string().datetime(), payload: createReturnSchema }),
  z.object({ kind: z.literal("SHOPIFY_RETURN"), clientCreatedAt: z.string().datetime(), payload: createShopifyReturnSchema }),
]);
export type SyncBundle = z.infer<typeof syncBundleSchema>;

export const syncPushRequestSchema = z.object({
  deviceUuid: z.string().uuid(),
  bundles: z.array(syncBundleSchema).min(1).max(50),
});
export type SyncPushRequest = z.infer<typeof syncPushRequestSchema>;

export const syncPushResultSchema = z.object({
  id: z.string().uuid(),
  status: z.nativeEnum(SyncBundleStatus),
  serverTimestamp: z.string().datetime(),
  error: z.string().optional(),
  // Only set for SALE bundles -- the sequential order number assigned
  // server-side at commit time, which the till has no way to know otherwise.
  orderNumber: z.string().nullable().optional(),
});
export type SyncPushResult = z.infer<typeof syncPushResultSchema>;

export const syncPushResponseSchema = z.object({
  results: z.array(syncPushResultSchema),
});
export type SyncPushResponse = z.infer<typeof syncPushResponseSchema>;

export const syncCatalogQuerySchema = z.object({
  branchId: z.string().uuid(),
  since: z.string().datetime().optional(),
  // Separate cursor for shopifyOrders/shopifyOrderItems -- these were added
  // to this endpoint after `since` was already in use by already-paired
  // tills, so reusing `since` for them would silently skip every Shopify
  // order older than a till's existing cursor. Omitted (or unset) means
  // "never pulled shopify orders yet" -> server returns the full set.
  shopifySince: z.string().datetime().optional(),
});
export type SyncCatalogQuery = z.infer<typeof syncCatalogQuerySchema>;
