import { getApiClient } from "../api-client";
import { syncWorker } from "../sync/sync-worker";
import type { TamaraCreateSessionRequest, TamaraCreateSessionResult } from "../../shared/ipc";

/**
 * Creating a Tamara checkout session is what triggers Tamara's own SMS to
 * the customer, so unlike every other write in this app it cannot be queued
 * for later like an offline order -- it must happen live. Mirrors
 * catalog-service.ts's online-only-call pattern (createCustomer/barcode
 * lookup): throws immediately if offline rather than silently doing nothing.
 */
export async function createTamaraCheckoutSession(input: TamaraCreateSessionRequest): Promise<TamaraCreateSessionResult> {
  if (!syncWorker.isOnline()) {
    throw new Error("Tamara checkout requires an internet connection");
  }
  const client = getApiClient();
  const { data } = await client.post("/tamara/checkout-session", {
    orderReferenceId: input.orderReferenceId,
    branchId: input.branchId,
    amount: input.amount,
    phoneNumber: input.phoneNumber,
    items: input.items.map((item) => ({
      referenceId: item.referenceId,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      totalAmount: item.totalAmount,
    })),
  });
  return { checkoutId: data.checkoutId, tamaraOrderId: data.orderId, checkoutDeeplink: data.checkoutDeeplink };
}
