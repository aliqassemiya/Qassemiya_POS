import type { StockAdjustInput } from "@qassemiya/shared-types";
import { apiClient } from "@/lib/apiClient";
import type { Inventory, StockMovement } from "@/types/entities";

export interface InventoryQuery {
  branchId?: string;
  variantId?: string;
  lowStock?: boolean;
}

export async function listInventory(query: InventoryQuery): Promise<Inventory[]> {
  const { data } = await apiClient.get<Inventory[]>("/inventory", { params: query });
  return data;
}

export async function adjustStock(input: StockAdjustInput): Promise<StockMovement> {
  const { data } = await apiClient.post<StockMovement>("/inventory/adjust", input);
  return data;
}

export async function listMovements(query: InventoryQuery): Promise<StockMovement[]> {
  const { data } = await apiClient.get<StockMovement[]>("/inventory/movements", { params: query });
  return data;
}
