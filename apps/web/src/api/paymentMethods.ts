import { apiClient } from "@/lib/apiClient";
import type { PaymentMethod } from "@/types/entities";

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  const { data } = await apiClient.get<PaymentMethod[]>("/payment-methods");
  return data;
}
