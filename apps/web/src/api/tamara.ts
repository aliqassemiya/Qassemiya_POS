import { apiClient } from "@/lib/apiClient";

export interface TamaraIntegrationStatus {
  id: string;
  environment: "sandbox" | "production";
  isActive: boolean;
  updatedAt: string;
}

// apiKey is optional — omitted means "keep the existing key" (the API never
// returns it, so there's nothing to prefill and re-send).
export interface TamaraIntegrationInput {
  apiKey?: string;
  environment: "sandbox" | "production";
  isActive?: boolean;
}

export async function getTamaraIntegration(): Promise<TamaraIntegrationStatus | null> {
  const { data } = await apiClient.get<TamaraIntegrationStatus | null>("/tamara/integration");
  return data;
}

export async function upsertTamaraIntegration(input: TamaraIntegrationInput): Promise<TamaraIntegrationStatus> {
  const { data } = await apiClient.put<TamaraIntegrationStatus>("/tamara/integration", input);
  return data;
}
