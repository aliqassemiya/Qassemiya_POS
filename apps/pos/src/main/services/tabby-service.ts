import { getApiClient } from "../api-client";
import { syncWorker } from "../sync/sync-worker";
import type { TabbyCreateSessionRequest, TabbyCreateSessionResult } from "../../shared/ipc";

/** Same online-only-call reasoning as tamara-service.ts -- creating the session (and triggering the SMS) must happen live. */
export async function createTabbyCheckoutSession(input: TabbyCreateSessionRequest): Promise<TabbyCreateSessionResult> {
  if (!syncWorker.isOnline()) {
    throw new Error("Tabby checkout requires an internet connection");
  }
  const client = getApiClient();
  const { data } = await client.post("/tabby/checkout-session", {
    orderReferenceId: input.orderReferenceId,
    branchId: input.branchId,
    amount: input.amount,
    phoneNumber: input.phoneNumber,
    items: input.items.map((item) => ({
      title: item.title,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  });
  return { sessionId: data.sessionId, paymentId: data.paymentId };
}
