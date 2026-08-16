import { apiClient } from "@/lib/apiClient";
import type { PurchaseOrder, PurchaseOrderStatus } from "@/types/entities";

// Matches packages/shared-types/src/purchasing.ts's createPurchaseOrderSchema
// exactly — header totals (subtotal/total) and per-item lineTotal are
// required by the API and computed client-side before submit, same
// convention as sales' createSaleSchema.
export interface PurchaseOrderItemInput {
  productVariantId: string;
  quantityOrdered: number;
  unitCost: number;
  taxAmount?: number;
  lineTotal: number;
}

export interface CreatePurchaseOrderInput {
  vendorId: string;
  branchId: string;
  expectedDate?: string;
  notes?: string;
  items: PurchaseOrderItemInput[];
  subtotal: number;
  discountTotal?: number;
  taxTotal?: number;
  total: number;
}

export interface UpdatePurchaseOrderInput {
  expectedDate?: string;
  notes?: string;
}

export interface PurchaseOrdersQuery {
  vendorId?: string;
  branchId?: string;
  status?: PurchaseOrderStatus;
  from?: string;
  to?: string;
}

export async function listPurchaseOrders(query: PurchaseOrdersQuery = {}): Promise<PurchaseOrder[]> {
  const { data } = await apiClient.get<PurchaseOrder[]>("/purchase-orders", { params: query });
  return data;
}

export async function getPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const { data } = await apiClient.get<PurchaseOrder>(`/purchase-orders/${id}`);
  return data;
}

export async function createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<PurchaseOrder> {
  const { data } = await apiClient.post<PurchaseOrder>("/purchase-orders", input);
  return data;
}

export async function updatePurchaseOrder(id: string, input: UpdatePurchaseOrderInput): Promise<PurchaseOrder> {
  const { data } = await apiClient.patch<PurchaseOrder>(`/purchase-orders/${id}`, input);
  return data;
}

export async function submitPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const { data } = await apiClient.post<PurchaseOrder>(`/purchase-orders/${id}/submit`);
  return data;
}

export async function cancelPurchaseOrder(id: string): Promise<PurchaseOrder> {
  const { data } = await apiClient.post<PurchaseOrder>(`/purchase-orders/${id}/cancel`);
  return data;
}
