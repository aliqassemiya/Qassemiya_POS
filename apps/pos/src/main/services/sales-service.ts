import { sql } from "kysely";
import { uuidv7 } from "uuidv7";
import { StockMovementType, OrderSource } from "@qassemiya/shared-types";
import { getDb } from "../db";
import { syncWorker } from "../sync/sync-worker";
import { getApiClient } from "../api-client";

export interface CheckoutItemInput {
  productVariantId: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
  costPriceSnapshot: number;
}

export interface CheckoutPaymentInput {
  paymentMethodId: string;
  methodName: string;
  amount: number;
  referenceNumber?: string;
  // PENDING for a Tamara/Tabby line awaiting manual confirmation later;
  // omitted (-> COMPLETED) for every other payment method, unchanged.
  status?: string;
}

export interface CheckoutInput {
  // Lets the renderer reserve the order's id up front -- needed for Tamara,
  // which must be given an order_reference_id *before* the local sale is
  // created, so the same id ends up as the real order id end to end.
  // Omitted for every other checkout, which still gets a fresh uuidv7() here.
  id?: string;
  branchId: string;
  cashierUserId: string;
  soldByEmployeeId?: string | null;
  customerId?: string | null;
  customerName?: string;
  items: CheckoutItemInput[];
  payments: CheckoutPaymentInput[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  notes?: string;
}

export interface CheckoutResult {
  orderId: string;
  createdAt: string;
}

/** Writes a completed sale to local SQLite in one transaction. Never touches the network. */
export async function createSale(input: CheckoutInput): Promise<CheckoutResult> {
  const db = getDb();
  const orderId = input.id ?? uuidv7();
  const createdAt = new Date().toISOString();

  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto("order")
      .values({
        id: orderId,
        branchId: input.branchId,
        cashierUserId: input.cashierUserId,
        soldByEmployeeId: input.soldByEmployeeId ?? null,
        customerId: input.customerId ?? null,
        source: OrderSource.POS,
        status: "COMPLETED",
        subtotal: input.subtotal,
        discountTotal: input.discountTotal,
        taxTotal: input.taxTotal,
        total: input.total,
        notes: input.notes ?? null,
        createdAt,
        syncedAt: null,
        syncAttempts: 0,
        lastSyncError: null,
        orderNumber: null,
      })
      .execute();

    for (const item of input.items) {
      await trx
        .insertInto("orderItem")
        .values({
          id: uuidv7(),
          orderId,
          productVariantId: item.productVariantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
          taxAmount: item.taxAmount,
          lineTotal: item.lineTotal,
          costPriceSnapshot: item.costPriceSnapshot,
        })
        .execute();

      const movementId = uuidv7();
      await trx
        .insertInto("stockMovement")
        .values({
          id: movementId,
          branchId: input.branchId,
          productVariantId: item.productVariantId,
          quantityChange: -item.quantity,
          type: StockMovementType.SALE,
          referenceType: "ORDER",
          referenceId: orderId,
          note: null,
          createdAt,
        })
        .execute();

      const updateResult = await trx
        .updateTable("inventory")
        .set({ quantityOnHand: sql`quantity_on_hand - ${item.quantity}`, updatedAt: createdAt })
        .where("branchId", "=", input.branchId)
        .where("productVariantId", "=", item.productVariantId)
        .executeTakeFirst();

      if (Number(updateResult.numUpdatedRows) === 0) {
        // Not in the local cache yet (e.g. catalog not synced) — seed a row so the till
        // still reflects the sale locally; the real balance arrives on next catalog pull.
        await trx
          .insertInto("inventory")
          .values({
            id: uuidv7(),
            branchId: input.branchId,
            productVariantId: item.productVariantId,
            quantityOnHand: -item.quantity,
            updatedAt: createdAt,
          })
          .execute();
      }
    }

    for (const payment of input.payments) {
      await trx
        .insertInto("payment")
        .values({
          id: uuidv7(),
          orderId,
          paymentMethodId: payment.paymentMethodId,
          amount: payment.amount,
          referenceNumber: payment.referenceNumber ?? null,
          status: payment.status ?? "COMPLETED",
        })
        .execute();
    }
  });

  // Fire-and-forget: attempt to sync immediately if online, without blocking checkout.
  syncWorker.notifyNewOrder();

  return { orderId, createdAt };
}

export interface OrderSummary {
  id: string;
  orderNumber: string | null;
  createdAt: string;
  total: number;
  status: string;
  syncedAt: string | null;
  customerId: string | null;
}

export async function listRecentOrders(branchId: string, limit = 50): Promise<OrderSummary[]> {
  const rows = await getDb()
    .selectFrom("order")
    .select(["id", "orderNumber", "createdAt", "total", "status", "syncedAt", "customerId"])
    .where("branchId", "=", branchId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .execute();
  return rows;
}

/**
 * One-time (well, ongoing) catch-up for orders that finished syncing
 * *before* the sequential-order-number feature existed to record the
 * number -- pushPending() only ever revisits orders with syncedAt IS NULL,
 * so an already-synced order's orderNumber would otherwise stay null
 * forever. Safe to call repeatedly and offline (just no-ops).
 */
export async function backfillOrderNumbers(): Promise<void> {
  if (!syncWorker.isOnline()) return;
  const db = getDb();
  const rows = await db
    .selectFrom("order")
    .select(["id"])
    .where("syncedAt", "is not", null)
    .where("orderNumber", "is", null)
    .limit(50)
    .execute();
  if (rows.length === 0) return;

  try {
    const client = getApiClient();
    const { data } = await client.get("/sales", { params: { ids: rows.map((r) => r.id).join(","), pageSize: 50 } });
    for (const order of data.data ?? []) {
      if (!order.orderNumber) continue;
      await db.updateTable("order").set({ orderNumber: order.orderNumber }).where("id", "=", order.id).execute();
    }
  } catch {
    // Best-effort -- will retry on the next tick.
  }
}

export interface ServerOrderSummary {
  id: string;
  orderNumber: string | null;
  branchName: string;
  createdAt: string;
  total: number;
}

/**
 * Looks up orders across EVERY branch, not just this till's own -- this is
 * what lets a cashier find and return an order rung up somewhere else
 * entirely. Inherently online-only: there is no local cache of other
 * branches'/tills' orders to fall back to.
 */
export async function searchServerOrders(query: string): Promise<ServerOrderSummary[]> {
  if (!syncWorker.isOnline()) {
    throw new Error("Searching orders from other branches requires an internet connection");
  }
  const client = getApiClient();
  const { data } = await client.get("/sales", { params: { search: query, pageSize: 20 } });
  return (data.data ?? []).map((order: any) => ({
    id: order.id,
    orderNumber: order.orderNumber ?? null,
    branchName: order.branch?.nameAr ?? order.branch?.name ?? "",
    createdAt: order.createdAt,
    total: Number(order.total),
  }));
}

/**
 * Not found locally means it wasn't rung up on this till -- falls back to
 * looking it up on the server (a different branch or a different till at
 * this same branch), which is the only place that would know about it.
 * Silently returns null when offline, same as "not found" -- there's
 * nothing else to fall back to.
 */
async function getRemoteOrderWithItems(orderId: string) {
  if (!syncWorker.isOnline()) return null;
  try {
    const client = getApiClient();
    const { data } = await client.get(`/sales/${orderId}`);
    return {
      order: { id: data.id, branchId: data.branchId, status: data.status },
      orderNumber: data.orderNumber ?? null,
      branchName: data.branch?.nameAr ?? data.branch?.name ?? null,
      customerName: data.customer?.fullName ?? null,
      customerPhone: data.customer?.phone ?? null,
      items: (data.items ?? []).map((item: any) => ({
        id: item.id,
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
        sku: item.productVariant?.sku ?? "",
        productName: item.productVariant?.product?.name ?? "",
        alreadyReturned: item.alreadyReturned ?? 0,
      })),
      payments: [],
    };
  } catch {
    return null;
  }
}

export async function getOrderWithItems(orderId: string) {
  const db = getDb();
  const order = await db.selectFrom("order").selectAll().where("id", "=", orderId).executeTakeFirst();
  if (!order) return getRemoteOrderWithItems(orderId);
  const items = await db
    .selectFrom("orderItem as oi")
    .innerJoin("productVariant as pv", "pv.id", "oi.productVariantId")
    .innerJoin("product as p", "p.id", "pv.productId")
    .select([
      "oi.id as id",
      "oi.productVariantId as productVariantId",
      "oi.quantity as quantity",
      "oi.unitPrice as unitPrice",
      "oi.lineTotal as lineTotal",
      "pv.sku as sku",
      "p.name as productName",
    ])
    .where("oi.orderId", "=", orderId)
    .execute();
  const payments = await db.selectFrom("payment").selectAll().where("orderId", "=", orderId).execute();
  const alreadyReturnedByItem = await db
    .selectFrom("returnItem as ri")
    .innerJoin("return as r", "r.id", "ri.returnId")
    .select(["ri.orderItemId as orderItemId", (eb) => eb.fn.sum<number>("ri.quantity").as("qty")])
    .where("r.orderId", "=", orderId)
    .groupBy("ri.orderItemId")
    .execute();
  const returnedMap = new Map(alreadyReturnedByItem.map((r) => [r.orderItemId, Number(r.qty)]));

  const customer = order.customerId
    ? await db.selectFrom("customer").select(["name", "phone"]).where("id", "=", order.customerId).executeTakeFirst()
    : null;

  return {
    order,
    orderNumber: order.orderNumber,
    branchName: null,
    customerName: customer?.name ?? null,
    customerPhone: customer?.phone ?? null,
    items: items.map((i) => ({ ...i, alreadyReturned: returnedMap.get(i.id) ?? 0 })),
    payments,
  };
}

export interface ReturnItemInputLocal {
  orderItemId: string;
  productVariantId: string;
  quantity: number;
  refundAmount: number;
  restocked: boolean;
}

export interface CreateReturnInputLocal {
  orderId: string;
  branchId: string;
  processedByUserId: string;
  /** Required — the server's GL posting needs to know which account the refund came out of. */
  refundPaymentMethodId: string;
  reason?: string;
  items: ReturnItemInputLocal[];
  totalRefundAmount: number;
}

/**
 * Cross-branch/cross-till return: the order was never rung up on this till,
 * so there's no local row for `return.order_id` to reference (a real FK
 * constraint) -- submitted directly to the server instead. Online-only,
 * same reasoning as the Tamara/Tabby checkout-session calls: there's no
 * offline queue for something with no local order to attach to.
 */
async function createRemoteReturn(
  returnId: string,
  createdAt: string,
  input: CreateReturnInputLocal,
): Promise<{ returnId: string; createdAt: string }> {
  if (!syncWorker.isOnline()) {
    throw new Error("Processing a return for an order from another branch requires an internet connection");
  }
  const client = getApiClient();
  const { data } = await client.post("/returns", {
    id: returnId,
    orderId: input.orderId,
    branchId: input.branchId,
    processedByUserId: input.processedByUserId,
    refundPaymentMethodId: input.refundPaymentMethodId,
    reason: input.reason,
    items: input.items.map((item) => ({
      orderItemId: item.orderItemId,
      quantity: item.quantity,
      refundAmount: item.refundAmount,
      restocked: item.restocked,
    })),
    totalRefundAmount: input.totalRefundAmount,
  });
  return { returnId: data.id, createdAt: data.createdAt };
}

export async function createReturn(input: CreateReturnInputLocal): Promise<{ returnId: string; createdAt: string }> {
  const db = getDb();
  const returnId = uuidv7();
  const createdAt = new Date().toISOString();

  const localOrder = await db.selectFrom("order").select(["id"]).where("id", "=", input.orderId).executeTakeFirst();
  if (!localOrder) {
    return createRemoteReturn(returnId, createdAt, input);
  }

  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto("return")
      .values({
        id: returnId,
        orderId: input.orderId,
        branchId: input.branchId,
        processedByUserId: input.processedByUserId,
        refundPaymentMethodId: input.refundPaymentMethodId,
        reason: input.reason ?? null,
        totalRefundAmount: input.totalRefundAmount,
        createdAt,
        syncedAt: null,
        syncAttempts: 0,
        lastSyncError: null,
      })
      .execute();

    for (const item of input.items) {
      await trx
        .insertInto("returnItem")
        .values({
          id: uuidv7(),
          returnId,
          orderItemId: item.orderItemId,
          quantity: item.quantity,
          refundAmount: item.refundAmount,
          restocked: item.restocked ? 1 : 0,
        })
        .execute();

      if (item.restocked) {
        const movementId = uuidv7();
        await trx
          .insertInto("stockMovement")
          .values({
            id: movementId,
            branchId: input.branchId,
            productVariantId: item.productVariantId,
            quantityChange: item.quantity,
            type: StockMovementType.RETURN,
            referenceType: "RETURN",
            referenceId: returnId,
            note: null,
            createdAt,
          })
          .execute();

        const updateResult = await trx
          .updateTable("inventory")
          .set({ quantityOnHand: sql`quantity_on_hand + ${item.quantity}`, updatedAt: createdAt })
          .where("branchId", "=", input.branchId)
          .where("productVariantId", "=", item.productVariantId)
          .executeTakeFirst();

        if (Number(updateResult.numUpdatedRows) === 0) {
          await trx
            .insertInto("inventory")
            .values({
              id: uuidv7(),
              branchId: input.branchId,
              productVariantId: item.productVariantId,
              quantityOnHand: item.quantity,
              updatedAt: createdAt,
            })
            .execute();
        }
      }
    }

    await trx.updateTable("order").set({ status: "REFUNDED" }).where("id", "=", input.orderId).execute();
  });

  syncWorker.notifyNewOrder();

  return { returnId, createdAt };
}
