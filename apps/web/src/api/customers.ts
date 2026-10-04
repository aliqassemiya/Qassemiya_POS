import { apiClient } from "@/lib/apiClient";
import type { Customer } from "@/types/entities";
import type { PaginatedResult } from "./pagination";

export interface CustomerInput {
  fullName: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface CustomersQuery {
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function listCustomers(query: CustomersQuery = {}): Promise<PaginatedResult<Customer>> {
  const { data } = await apiClient.get<PaginatedResult<Customer>>("/customers", { params: query });
  return data;
}

export async function getCustomer(id: string): Promise<Customer> {
  const { data } = await apiClient.get<Customer>(`/customers/${id}`);
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
