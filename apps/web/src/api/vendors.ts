import { apiClient } from "@/lib/apiClient";
import type { Vendor, VendorStatement } from "@/types/entities";

// No shared-types schema exists for Vendor yet (packages/shared-types/src/purchasing.ts
// is being built in parallel) — this mirrors the Vendor model fields described
// in the plan, same convention as api/branches.ts and api/customers.ts.
export interface VendorInput {
  code: string;
  numericCode: number;
  name: string;
  nameAr?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  vatNumber?: string;
  paymentTermsDays?: number;
  notes?: string;
  isActive?: boolean;
}

export interface VendorsQuery {
  search?: string;
  isActive?: boolean;
}

export async function listVendors(query: VendorsQuery = {}): Promise<Vendor[]> {
  const { data } = await apiClient.get<Vendor[]>("/vendors", { params: query });
  return data;
}

export async function getVendor(id: string): Promise<Vendor> {
  const { data } = await apiClient.get<Vendor>(`/vendors/${id}`);
  return data;
}

export async function createVendor(input: VendorInput): Promise<Vendor> {
  const { data } = await apiClient.post<Vendor>("/vendors", input);
  return data;
}

export async function updateVendor(id: string, input: Partial<VendorInput>): Promise<Vendor> {
  const { data } = await apiClient.patch<Vendor>(`/vendors/${id}`, input);
  return data;
}

export async function getVendorStatement(id: string): Promise<VendorStatement> {
  const { data } = await apiClient.get<VendorStatement>(`/vendors/${id}/statement`);
  return data;
}
