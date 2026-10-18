import { apiClient } from "@/lib/apiClient";
import type { ShopifyReturn } from "@/types/entities";
import type { PaginatedResult } from "./pagination";

export interface ShopifyReturnsQuery {
  branchId?: string;
  shopifyOrderId?: string;
  page?: number;
  pageSize?: number;
}

export async function listShopifyReturns(query: ShopifyReturnsQuery = {}): Promise<PaginatedResult<ShopifyReturn>> {
  const { data } = await apiClient.get<PaginatedResult<ShopifyReturn>>("/shopify-returns", { params: query });
  return data;
}

export async function getShopifyReturn(id: string): Promise<ShopifyReturn> {
  const { data } = await apiClient.get<ShopifyReturn>(`/shopify-returns/${id}`);
  return data;
}
