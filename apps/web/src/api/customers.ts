import { apiClient } from "@/lib/apiClient";
import type { Customer } from "@/types/entities";

export interface CustomerInput {
  fullName: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export async function listCustomers(search?: string): Promise<Customer[]> {
  const { data } = await apiClient.get<Customer[]>("/customers", { params: { search } });
  return data;
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const { data } = await apiClient.post<Customer>("/customers", input);
  return data;
}

export async function updateCustomer(id: string, input: Partial<CustomerInput>): Promise<Customer> {
  const { data } = await apiClient.patch<Customer>(`/customers/${id}`, input);
  return data;
}
