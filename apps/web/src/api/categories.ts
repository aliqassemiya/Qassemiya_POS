import type { CategoryInput } from "@qassemiya/shared-types";
import { apiClient } from "@/lib/apiClient";
import type { Category } from "@/types/entities";

export async function listCategories(): Promise<Category[]> {
  const { data } = await apiClient.get<Category[]>("/categories");
  return data;
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  const { data } = await apiClient.post<Category>("/categories", input);
  return data;
}
