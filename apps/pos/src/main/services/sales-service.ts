import { sql } from "kysely";
import { uuidv7 } from "uuidv7";
import { StockMovementType, OrderSource } from "@qassemiya/shared-types";
import { getDb } from "../db";
import { syncWorker } from "../sync/sync-worker";

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
}

export interface CheckoutInput {
  branchId: string;
  cashierUserId: string;
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
  const orderId = uuidv7();
  const createdAt = new Date().toISOString();

  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto("order")
      .values({
        id: orderId,
        branchId: input.branchId,
        cashierUserId: input.cashierUserId,
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
  createdAt: string;
  total: number;
  status: string;
  syncedAt: string | null;
  customerId: string | null;
}

export async function listRecentOrders(branchId: string, limit = 50): Promise<OrderSummary[]> {
  const rows = await getDb()
    .selectFrom("order")
    .select(["id", "createdAt", "total", "status", "syncedAt", "customerId"])
    .where("branchId", "=", branchId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .execute();
  return rows;
}

export async function getOrderWithItems(orderId: string) {
  const db = getDb();
  const order = await db.selectFrom("order").selectAll().where("id", "=", orderId).executeTakeFirst();
  if (!order) return null;
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

  return {
    order,
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

export async function createReturn(input: CreateReturnInputLocal): Promise<{ returnId: string; createdAt: string }> {
  const db = getDb();
  const returnId = uuidv7();
  const createdAt = new Date().toISOString();

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
