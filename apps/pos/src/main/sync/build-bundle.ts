import type { SyncBundle } from "@qassemiya/shared-types";
import { OrderSource } from "@qassemiya/shared-types";
import { getDb } from "../db";

/** Builds the exact SyncBundle (kind: "SALE") wire shape for one locally-created order. */
export async function buildSaleBundle(orderId: string): Promise<SyncBundle | null> {
  const db = getDb();
  const order = await db.selectFrom("order").selectAll().where("id", "=", orderId).executeTakeFirst();
  if (!order) return null;

  const items = await db.selectFrom("orderItem").selectAll().where("orderId", "=", orderId).execute();
  const payments = await db.selectFrom("payment").selectAll().where("orderId", "=", orderId).execute();

  return {
    kind: "SALE",
    clientCreatedAt: new Date(order.createdAt).toISOString(),
    payload: {
      id: order.id,
      branchId: order.branchId,
      cashierUserId: order.cashierUserId,
      customerId: order.customerId ?? undefined,
      source: (order.source as (typeof OrderSource)[keyof typeof OrderSource]) ?? OrderSource.POS,
      items: items.map((item) => ({
        productVariantId: item.productVariantId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount,
        taxAmount: item.taxAmount,
        lineTotal: item.lineTotal,
        costPriceSnapshot: item.costPriceSnapshot,
      })),
      payments: payments.map((payment) => ({
        paymentMethodId: payment.paymentMethodId,
        amount: payment.amount,
        referenceNumber: payment.referenceNumber ?? undefined,
      })),
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      taxTotal: order.taxTotal,
      total: order.total,
      notes: order.notes ?? undefined,
    },
  };
}

/** Builds the exact SyncBundle (kind: "RETURN") wire shape for one locally-created return. */
export async function buildReturnBundle(returnId: string): Promise<SyncBundle | null> {
  const db = getDb();
  const ret = await db.selectFrom("return").selectAll().where("id", "=", returnId).executeTakeFirst();
  if (!ret) return null;

  const items = await db.selectFrom("returnItem").selectAll().where("returnId", "=", returnId).execute();

  return {
    kind: "RETURN",
    clientCreatedAt: new Date(ret.createdAt).toISOString(),
    payload: {
      id: ret.id,
      orderId: ret.orderId,
      branchId: ret.branchId,
      processedByUserId: ret.processedByUserId,
      refundPaymentMethodId: ret.refundPaymentMethodId ?? "",
      reason: ret.reason ?? undefined,
      items: items.map((item) => ({
        orderItemId: item.orderItemId,
        quantity: item.quantity,
        refundAmount: item.refundAmount,
        restocked: Boolean(item.restocked),
      })),
      totalRefundAmount: ret.totalRefundAmount,
    },
  };
}
