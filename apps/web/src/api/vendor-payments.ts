import { apiClient } from "@/lib/apiClient";
import type { VendorPayment } from "@/types/entities";

// No shared-types schema exists for VendorPayment yet — see the note atop
// types/entities.ts. `purchaseInvoiceId` is optional to allow on-account
// lump-sum payments, per the plan.
export interface CreateVendorPaymentInput {
  vendorId: string;
  purchaseInvoiceId?: string;
  amount: number;
  paymentMethodId: string;
  referenceNumber?: string;
  paidAt?: string;
}

export interface VendorPaymentsQuery {
  vendorId?: string;
  purchaseInvoiceId?: string;
}

export async function listVendorPayments(query: VendorPaymentsQuery = {}): Promise<VendorPayment[]> {
  const { data } = await apiClient.get<VendorPayment[]>("/vendor-payments", { params: query });
  return data;
}

export async function getVendorPayment(id: string): Promise<VendorPayment> {
  const { data } = await apiClient.get<VendorPayment>(`/vendor-payments/${id}`);
  return data;
}

export async function createVendorPayment(input: CreateVendorPaymentInput): Promise<VendorPayment> {
  const { data } = await apiClient.post<VendorPayment>("/vendor-payments", input);
  return data;
}
