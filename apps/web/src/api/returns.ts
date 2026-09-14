import type { CreateReturnInput } from "@qassemiya/shared-types";
import { apiClient } from "@/lib/apiClient";
import type { Return } from "@/types/entities";
import type { PaginatedResult } from "./pagination";

export interface ReturnsQuery {
  branchId?: string;
  page?: number;
  pageSize?: number;
}

export async function listReturns(query: ReturnsQuery = {}): Promise<PaginatedResult<Return>> {
  const { data } = await apiClient.get<PaginatedResult<Return>>("/returns", { params: query });
  return data;
}

export async function createReturn(input: CreateReturnInput): Promise<Return> {
  const { data } = await apiClient.post<Return>("/returns", input);
  return data;
}
