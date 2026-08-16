import { apiClient } from "@/lib/apiClient";
import type { GoodsReceipt } from "@/types/entities";

// No shared-types schema exists for GoodsReceipt yet — see the note atop
// types/entities.ts. createGoodsReceiptTx (per the plan) mirrors
// ReturnsService.createReturnTx: header + items created in one call.
// Field is `quantity`, not `quantityReceived` — matches
// packages/shared-types/src/purchasing.ts's goodsReceiptItemSchema exactly
// (distinct from PurchaseOrderItem.quantityReceived, the server-side running
// total this creates a delta against).
export interface GoodsReceiptItemInput {
  purchaseOrderItemId: string;
  productVariantId: string;
  quantity: number;
  unitCost: number;
}

export interface CreateGoodsReceiptInput {
  purchaseOrderId: string;
  branchId: string;
  deliveryNoteRef?: string;
  items: GoodsReceiptItemInput[];
}

export interface GoodsReceiptsQuery {
  purchaseOrderId?: string;
  branchId?: string;
}

export async function listGoodsReceipts(query: GoodsReceiptsQuery = {}): Promise<GoodsReceipt[]> {
  const { data } = await apiClient.get<GoodsReceipt[]>("/goods-receipts", { params: query });
  return data;
}

export async function getGoodsReceipt(id: string): Promise<GoodsReceipt> {
  const { data } = await apiClient.get<GoodsReceipt>(`/goods-receipts/${id}`);
  return data;
}

export async function createGoodsReceipt(input: CreateGoodsReceiptInput): Promise<GoodsReceipt> {
  const { data } = await apiClient.post<GoodsReceipt>("/goods-receipts", input);
  return data;
}
