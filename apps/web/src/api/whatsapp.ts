import { apiClient } from "@/lib/apiClient";

// No shared-types schemas exist for these response shapes yet — matches the
// existing convention in api/shopify.ts.

export interface WhatsAppIntegrationStatus {
  id: string;
  phoneNumberId: string;
  wabaId: string;
  apiVersion: string;
  templateName: string;
  templateLanguage: string;
  isActive: boolean;
  updatedAt: string;
}

// accessToken is optional — omitted means "keep the existing token" (the
// API never returns it, so there's nothing to prefill and re-send).
export interface WhatsAppIntegrationInput {
  phoneNumberId: string;
  wabaId: string;
  accessToken?: string;
  templateName: string;
  templateLanguage: string;
  isActive?: boolean;
}

export interface WhatsAppPhoneNumberInfo {
  displayPhoneNumber: string;
  verifiedName: string;
}

export type WhatsAppMessageStatus = "SENT" | "SKIPPED" | "FAILED";

export interface WhatsAppMessageLog {
  id: string;
  orderId: string;
  customerPhone: string | null;
  status: WhatsAppMessageStatus;
  templateName: string | null;
  whatsappMessageId: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export async function getWhatsAppIntegration(): Promise<WhatsAppIntegrationStatus | null> {
  const { data } = await apiClient.get<WhatsAppIntegrationStatus | null>("/whatsapp/integration");
  return data;
}

export async function upsertWhatsAppIntegration(input: WhatsAppIntegrationInput): Promise<WhatsAppIntegrationStatus> {
  const { data } = await apiClient.put<WhatsAppIntegrationStatus>("/whatsapp/integration", input);
  return data;
}

export async function testWhatsAppConnection(input: {
  phoneNumberId: string;
  accessToken: string;
}): Promise<WhatsAppPhoneNumberInfo> {
  const { data } = await apiClient.post<WhatsAppPhoneNumberInfo>("/whatsapp/integration/test-connection", input);
  return data;
}

export async function listWhatsAppMessageLogs(orderId?: string): Promise<WhatsAppMessageLog[]> {
  const { data } = await apiClient.get<WhatsAppMessageLog[]>("/whatsapp/message-logs", { params: { orderId } });
  return data;
}

export async function resendWhatsAppInvoice(orderId: string): Promise<WhatsAppMessageLog[]> {
  const { data } = await apiClient.post<WhatsAppMessageLog[]>(`/whatsapp/orders/${orderId}/resend`);
  return data;
}
