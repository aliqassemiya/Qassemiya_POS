import { apiClient } from "@/lib/apiClient";

export interface TabbyIntegrationStatus {
  id: string;
  merchantCode: string;
  region: "KSA" | "UAE";
  isActive: boolean;
  updatedAt: string;
}

// secretKey is optional — omitted means "keep the existing key" (the API
// never returns it, so there's nothing to prefill and re-send).
export interface TabbyIntegrationInput {
  secretKey?: string;
  merchantCode: string;
  region: "KSA" | "UAE";
  isActive?: boolean;
}

export async function getTabbyIntegration(): Promise<TabbyIntegrationStatus | null> {
  const { data } = await apiClient.get<TabbyIntegrationStatus | null>("/tabby/integration");
  return data;
}

export async function upsertTabbyIntegration(input: TabbyIntegrationInput): Promise<TabbyIntegrationStatus> {
  const { data } = await apiClient.put<TabbyIntegrationStatus>("/tabby/integration", input);
  return data;
}
