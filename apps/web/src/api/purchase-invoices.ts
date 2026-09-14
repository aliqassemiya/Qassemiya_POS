import { apiClient } from "@/lib/apiClient";
import type { PurchaseInvoice, PurchaseInvoiceStatus } from "@/types/entities";
import type { PaginatedResult } from "./pagination";

// No shared-types schema exists for PurchaseInvoice yet — see the note atop
// types/entities.ts.
export interface CreatePurchaseInvoiceInput {
  vendorId: string;
  purchaseOrderId?: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  subtotal: number;
  taxTotal: number;
  total: number;
  notes?: string;
}

export interface PurchaseInvoicesQuery {
  vendorId?: string;
  status?: PurchaseInvoiceStatus;
  page?: number;
  pageSize?: number;
}

export async function listPurchaseInvoices(query: PurchaseInvoicesQuery = {}): Promise<PaginatedResult<PurchaseInvoice>> {
  const { data } = await apiClient.get<PaginatedResult<PurchaseInvoice>>("/purchase-invoices", { params: query });
  return data;
}

export async function getPurchaseInvoice(id: string): Promise<PurchaseInvoice> {
  const { data } = await apiClient.get<PurchaseInvoice>(`/purchase-invoices/${id}`);
  return data;
}

export async function createPurchaseInvoice(input: CreatePurchaseInvoiceInput): Promise<PurchaseInvoice> {
  const { data } = await apiClient.post<PurchaseInvoice>("/purchase-invoices", input);
  return data;
}

export async function updatePurchaseInvoice(
  id: string,
  input: Partial<CreatePurchaseInvoiceInput>,
): Promise<PurchaseInvoice> {
  const { data } = await apiClient.patch<PurchaseInvoice>(`/purchase-invoices/${id}`, input);
  return data;
}

export async function cancelPurchaseInvoice(id: string): Promise<PurchaseInvoice> {
  const { data } = await apiClient.post<PurchaseInvoice>(`/purchase-invoices/${id}/cancel`);
  return data;
}
