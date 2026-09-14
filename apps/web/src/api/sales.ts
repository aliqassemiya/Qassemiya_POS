import { apiClient } from "@/lib/apiClient";
import type { Order } from "@/types/entities";
import type { PaginatedResult } from "./pagination";

export interface SalesQuery {
  branchId?: string;
  paymentMethodId?: string;
  soldByEmployeeId?: string;
  from?: string;
  to?: string;
  /** Matches the order number shown in the UI (id's first 8 chars) OR any line item's SKU. */
  search?: string;
  page?: number;
  pageSize?: number;
}

// totalAmount sums ALL orders matching the filters, not just the current page.
export interface SalesListResult extends PaginatedResult<Order> {
  totalAmount: number;
}

export async function listSales(query: SalesQuery): Promise<SalesListResult> {
  const { data } = await apiClient.get<SalesListResult>("/sales", { params: query });
  return data;
}

export async function getSale(id: string): Promise<Order> {
  const { data } = await apiClient.get<Order>(`/sales/${id}`);
  return data;
}

export async function voidSale(id: string, reason?: string): Promise<Order> {
  const { data } = await apiClient.post<Order>(`/sales/${id}/void`, { reason });
  return data;
}
