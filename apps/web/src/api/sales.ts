import { apiClient } from "@/lib/apiClient";
import type { Order } from "@/types/entities";

export interface SalesQuery {
  branchId?: string;
  paymentMethodId?: string;
  soldByEmployeeId?: string;
  from?: string;
  to?: string;
}

export async function listSales(query: SalesQuery): Promise<Order[]> {
  const { data } = await apiClient.get<Order[]>("/sales", { params: query });
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
