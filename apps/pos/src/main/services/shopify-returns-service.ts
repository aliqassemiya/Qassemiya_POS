import { uuidv7 } from "uuidv7";
import { getDb } from "../db";
import { syncWorker } from "../sync/sync-worker";

export interface LocalShopifyOrderSummary {
  id: string;
  orderNumber: string;
  shopifyCreatedAt: string;
  currentTotalPrice: number;
  currency: string;
  customerName: string | null;
}

/** Pure local SQLite search over the catalog-pull cache -- no network call, works fully offline. */
export async function searchLocalShopifyOrders(query: string): Promise<LocalShopifyOrderSummary[]> {
  const db = getDb();
  const like = `%${query}%`;
  return db
    .selectFrom("shopifyOrder")
    .select(["id", "orderNumber", "shopifyCreatedAt", "currentTotalPrice", "currency", "customerName"])
    .where((eb) =>
      eb.or([eb("orderNumber", "like", like), eb("customerName", "like", like), eb("customerPhone", "like", like)]),
    )
    .orderBy("shopifyCreatedAt", "desc")
    .limit(25)
    .execute();
}

export interface LocalShopifyOrderItemRow {
  id: string;
  sku: string | null;
  title: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  alreadyReturned: number;
}

export interface LocalShopifyOrderWithItems {
  id: string;
  orderNumber: string;
  shopifyCreatedAt: string;
  customerName: string | null;
  customerPhone: string | null;
  items: LocalShopifyOrderItemRow[];
}

/** Local read -- computes alreadyReturned per item from local shopify_return_item rows. */
export async function getLocalShopifyOrderWithItems(shopifyOrderId: string): Promise<LocalShopifyOrderWithItems | null> {
  const db = getDb();
  const order = await db
    .selectFrom("shopifyOrder")
    .select(["id", "orderNumber", "shopifyCreatedAt", "customerName", "customerPhone"])
    .where("id", "=", shopifyOrderId)
    .executeTakeFirst();
  if (!order) return null;

  const items = await db
    .selectFrom("shopifyOrderItem")
    .select(["id", "sku", "title", "quantity", "unitPrice", "lineTotal"])
    .where("shopifyOrderId", "=", shopifyOrderId)
    .execute();

  const alreadyReturnedRows = await db
    .selectFrom("shopifyReturnItem as sri")
    .innerJoin("shopifyReturn as sr", "sr.id", "sri.shopifyReturnId")
    .select(["sri.shopifyOrderItemId as shopifyOrderItemId", (eb) => eb.fn.sum<number>("sri.quantity").as("qty")])
    .where("sr.shopifyOrderId", "=", shopifyOrderId)
    .groupBy("sri.shopifyOrderItemId")
    .execute();
  const returnedMap = new Map(alreadyReturnedRows.map((r) => [r.shopifyOrderItemId, Number(r.qty)]));

  return {
    ...order,
    items: items.map((i) => ({ ...i, alreadyReturned: returnedMap.get(i.id) ?? 0 })),
  };
}

export interface CreateShopifyReturnInputLocal {
  shopifyOrderId: string;
  branchId: string;
  processedByUserId: string;
  reason?: string;
  items: Array<{ shopifyOrderItemId: string; quantity: number }>;
}

/**
 * Always local-first, regardless of connectivity -- writes shopify_return
 * and shopify_return_item to SQLite immediately, same as in-store
 * createReturn. No stockMovement row is written (unlike createReturn):
 * online returns never touch inventory. The sync worker picks this row up
 * on its next push, same as every other offline-created row.
 */
export async function createShopifyReturn(input: CreateShopifyReturnInputLocal): Promise<{ returnId: string; createdAt: string }> {
  const db = getDb();
  const returnId = uuidv7();
  const createdAt = new Date().toISOString();

  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto("shopifyReturn")
      .values({
        id: returnId,
        shopifyOrderId: input.shopifyOrderId,
        branchId: input.branchId,
        processedByUserId: input.processedByUserId,
        reason: input.reason ?? null,
        createdAt,
        syncedAt: null,
        syncAttempts: 0,
        lastSyncError: null,
      })
      .execute();

    for (const item of input.items) {
      await trx
        .insertInto("shopifyReturnItem")
        .values({
          id: uuidv7(),
          shopifyReturnId: returnId,
          shopifyOrderItemId: item.shopifyOrderItemId,
          quantity: item.quantity,
        })
        .execute();
    }
  });

  syncWorker.notifyNewOrder();
  return { returnId, createdAt };
}
