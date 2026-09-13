import { apiClient } from "@/lib/apiClient";

// No shared-types schemas exist for these response shapes yet — matches the
// existing convention in api/reports.ts for the Finance module's reports.

export interface ShopifyIntegrationStatus {
  id: string;
  shopDomain: string;
  apiVersion: string;
  isActive: boolean;
  syncFromDate: string;
  syncCursor: string | null;
  lastSyncedAt: string | null;
}

// accessToken is optional — omitted means "keep the existing token" (the
// API never returns it, so there's nothing to prefill and re-send).
export interface ShopifyIntegrationInput {
  shopDomain: string;
  accessToken?: string;
  isActive?: boolean;
}

export interface ShopifyShopInfo {
  name: string;
  currency: string;
}

export type ShopifySyncStatus = "IN_PROGRESS" | "SUCCESS" | "FAILED";
export type ShopifySyncTrigger = "CRON" | "MANUAL";

export interface ShopifySyncLog {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: ShopifySyncStatus;
  triggeredBy: ShopifySyncTrigger;
  ordersFetched: number;
  ordersUpserted: number;
  cursorFrom: string | null;
  cursorTo: string | null;
  errorMessage: string | null;
}

export interface ShopifyRunSyncResult {
  skipped: boolean;
  reason?: string;
  ordersFetched?: number;
  ordersUpserted?: number;
}

export interface ShopifyOrderItem {
  id: string;
  sku: string | null;
  title: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  productVariantId: string | null;
}

export interface ShopifyOrder {
  id: string;
  shopifyOrderId: string;
  orderNumber: string;
  shopifyCreatedAt: string;
  shopifyUpdatedAt: string;
  cancelledAt: string | null;
  financialStatus: string;
  currency: string;
  totalPrice: number;
  currentTotalPrice: number;
  subtotalPrice: number;
  totalDiscounts: number;
  discountCodes: string | null;
  totalShipping: number;
  shippingTitle: string | null;
  totalTax: number;
  taxRate: number | null;
  taxesIncluded: boolean;
  totalOutstanding: number;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  items: ShopifyOrderItem[];
}

export interface ShopifyOrderListQuery {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  unmatchedOnly?: boolean;
}

export async function getShopifyIntegration(): Promise<ShopifyIntegrationStatus | null> {
  const { data } = await apiClient.get<ShopifyIntegrationStatus | null>("/shopify/integration");
  return data;
}

export async function upsertShopifyIntegration(input: ShopifyIntegrationInput): Promise<ShopifyIntegrationStatus> {
  const { data } = await apiClient.put<ShopifyIntegrationStatus>("/shopify/integration", input);
  return data;
}

export async function testShopifyConnection(input: {
  shopDomain: string;
  accessToken: string;
}): Promise<ShopifyShopInfo> {
  const { data } = await apiClient.post<ShopifyShopInfo>("/shopify/integration/test-connection", input);
  return data;
}

export async function runShopifySync(): Promise<ShopifyRunSyncResult> {
  const { data } = await apiClient.post<ShopifyRunSyncResult>("/shopify/sync/run");
  return data;
}

export async function listShopifySyncLogs(): Promise<ShopifySyncLog[]> {
  const { data } = await apiClient.get<ShopifySyncLog[]>("/shopify/sync/logs");
  return data;
}

export interface ShopifyOrderListResult {
  orders: ShopifyOrder[];
  totalCount: number;
}

export async function listShopifyOrders(query: ShopifyOrderListQuery = {}): Promise<ShopifyOrderListResult> {
  const { data } = await apiClient.get<ShopifyOrderListResult>("/shopify/orders", { params: query });
  return data;
}

export async function getShopifyOrder(id: string): Promise<ShopifyOrder> {
  const { data } = await apiClient.get<ShopifyOrder>(`/shopify/orders/${id}`);
  return data;
}
