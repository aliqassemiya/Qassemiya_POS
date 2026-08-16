import type { ProductInput, ProductVariantInput, VariantBulkUpdateRow } from "@qassemiya/shared-types";
import { apiClient } from "@/lib/apiClient";
import type { Product, ProductVariant } from "@/types/entities";

export interface ProductsQuery {
  search?: string;
  categoryId?: string;
}

export async function listProducts(query: ProductsQuery): Promise<Product[]> {
  const { data } = await apiClient.get<Product[]>("/products", { params: query });
  return data;
}

export async function getProduct(id: string): Promise<Product> {
  const { data } = await apiClient.get<Product>(`/products/${id}`);
  return data;
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const { data } = await apiClient.post<Product>("/products", input);
  return data;
}

export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<Product> {
  const { data } = await apiClient.patch<Product>(`/products/${id}`, input);
  return data;
}

export async function addVariant(productId: string, input: ProductVariantInput): Promise<ProductVariant> {
  const { data } = await apiClient.post<ProductVariant>(`/products/${productId}/variants`, input);
  return data;
}

export async function updateVariant(
  variantId: string,
  input: Partial<ProductVariantInput>,
): Promise<ProductVariant> {
  const { data } = await apiClient.patch<ProductVariant>(`/variants/${variantId}`, input);
  return data;
}

export async function getVariantByBarcode(barcode: string): Promise<ProductVariant> {
  const { data } = await apiClient.get<ProductVariant>(`/variants/barcode/${barcode}`);
  return data;
}

export interface BulkUpdateResult {
  updated: number;
  errorCount: number;
  errors: Array<{ row: number; message: string }>;
}

export async function bulkUpdateVariants(rows: VariantBulkUpdateRow[]): Promise<BulkUpdateResult> {
  const { data } = await apiClient.post<BulkUpdateResult>("/products/bulk-update", { rows });
  return data;
}
