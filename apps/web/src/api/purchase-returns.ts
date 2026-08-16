import { apiClient } from "@/lib/apiClient";
import type { PurchaseReturn } from "@/types/entities";

// No shared-types schema exists for PurchaseReturn yet — see the note atop
// types/entities.ts. Mirrors Return/ReturnItem 1:1 per the plan, but always
// tied to a purchaseOrderId/purchaseOrderItemId instead of an orderId.
export interface PurchaseReturnItemInput {
  purchaseOrderItemId: string;
  quantity: number;
  creditAmount: number;
}

export interface CreatePurchaseReturnInput {
  id: string;
  purchaseOrderId: string;
  branchId: string;
  processedByUserId: string;
  reason?: string;
  items: PurchaseReturnItemInput[];
  totalCreditAmount: number;
}

export interface PurchaseReturnsQuery {
  purchaseOrderId?: string;
  branchId?: string;
}

export async function listPurchaseReturns(query: PurchaseReturnsQuery = {}): Promise<PurchaseReturn[]> {
  const { data } = await apiClient.get<PurchaseReturn[]>("/purchase-returns", { params: query });
  return data;
}

export async function getPurchaseReturn(id: string): Promise<PurchaseReturn> {
  const { data } = await apiClient.get<PurchaseReturn>(`/purchase-returns/${id}`);
  return data;
}

export async function createPurchaseReturn(input: CreatePurchaseReturnInput): Promise<PurchaseReturn> {
  const { data } = await apiClient.post<PurchaseReturn>("/purchase-returns", input);
  return data;
}
