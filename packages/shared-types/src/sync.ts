import { z } from "zod";
import { createSaleSchema, createReturnSchema } from "./sales";
import { SyncBundleStatus } from "./enums";

/**
 * A sync bundle is exactly one offline-created sale or return, carrying every
 * row it needs (order/items/payments or return/items) so the server can
 * upsert-by-id inside a single transaction. The bundle id IS the idempotency key.
 */
export const syncBundleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("SALE"), clientCreatedAt: z.string().datetime(), payload: createSaleSchema }),
  z.object({ kind: z.literal("RETURN"), clientCreatedAt: z.string().datetime(), payload: createReturnSchema }),
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
});
export type SyncPushResult = z.infer<typeof syncPushResultSchema>;

export const syncPushResponseSchema = z.object({
  results: z.array(syncPushResultSchema),
});
export type SyncPushResponse = z.infer<typeof syncPushResponseSchema>;

export const syncCatalogQuerySchema = z.object({
  branchId: z.string().uuid(),
  since: z.string().datetime().optional(),
});
export type SyncCatalogQuery = z.infer<typeof syncCatalogQuerySchema>;
