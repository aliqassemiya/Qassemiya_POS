import type { InventoryBulkAdjustRow, StockAdjustInput, StockTransferInput } from "@qassemiya/shared-types";
import { apiClient } from "@/lib/apiClient";
import type { Inventory, StockMovement } from "@/types/entities";
import type { PaginatedResult } from "./pagination";

export interface InventoryQuery {
  branchId?: string;
  variantId?: string;
  page?: number;
  pageSize?: number;
}

export async function listInventory(query: InventoryQuery): Promise<PaginatedResult<Inventory>> {
  const { data } = await apiClient.get<PaginatedResult<Inventory>>("/inventory", { params: query });
  return data;
}

export async function adjustStock(input: StockAdjustInput): Promise<StockMovement> {
  const { data } = await apiClient.post<StockMovement>("/inventory/adjust", input);
  return data;
}

export async function listMovements(query: InventoryQuery): Promise<PaginatedResult<StockMovement>> {
  const { data } = await apiClient.get<PaginatedResult<StockMovement>>("/inventory/movements", { params: query });
  return data;
}

export async function transferStock(input: StockTransferInput): Promise<Inventory[]> {
  const { data } = await apiClient.post<Inventory[]>("/inventory/transfer", input);
  return data;
}

export interface BulkAdjustResult {
  updated: number;
  errorCount: number;
  errors: Array<{ row: number; message: string }>;
}

export async function bulkAdjustInventory(rows: InventoryBulkAdjustRow[]): Promise<BulkAdjustResult> {
  const { data } = await apiClient.post<BulkAdjustResult>("/inventory/bulk-adjust", { rows });
  return data;
}
