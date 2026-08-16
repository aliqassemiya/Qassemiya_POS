import type { CreateReturnInput } from "@qassemiya/shared-types";
import { apiClient } from "@/lib/apiClient";
import type { Return } from "@/types/entities";

export async function listReturns(query: { branchId?: string } = {}): Promise<Return[]> {
  const { data } = await apiClient.get<Return[]>("/returns", { params: query });
  return data;
}

export async function createReturn(input: CreateReturnInput): Promise<Return> {
  const { data } = await apiClient.post<Return>("/returns", input);
  return data;
}
