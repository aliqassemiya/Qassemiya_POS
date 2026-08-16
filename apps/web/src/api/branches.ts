import { apiClient } from "@/lib/apiClient";
import type { Branch } from "@/types/entities";

export interface BranchInput {
  name: string;
  nameAr?: string;
  address?: string;
  phone?: string;
  vatNumber?: string;
  isActive?: boolean;
}

export async function listBranches(): Promise<Branch[]> {
  const { data } = await apiClient.get<Branch[]>("/branches");
  return data;
}

export async function createBranch(input: BranchInput): Promise<Branch> {
  const { data } = await apiClient.post<Branch>("/branches", input);
  return data;
}

export async function updateBranch(id: string, input: Partial<BranchInput>): Promise<Branch> {
  const { data } = await apiClient.patch<Branch>(`/branches/${id}`, input);
  return data;
}
