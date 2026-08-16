import { apiClient } from "@/lib/apiClient";
import type { JournalEntry } from "@/types/entities";

// No shared-types schema exists for JournalEntry yet — see the note atop
// types/entities.ts. Journal entries are append-only (no update/delete),
// per the plan — corrections happen via a new reversing entry.
export interface JournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}

// Manual entries created from the web UI always send sourceType: "MANUAL"
// and no sourceId/reversalOfEntryId — those fields exist server-side for
// auto-posted entries from other services.
export interface CreateJournalEntryInput {
  entryDate: string;
  description: string;
  branchId?: string;
  lines: JournalLineInput[];
}

export interface JournalEntriesQuery {
  branchId?: string;
  sourceType?: string;
  from?: string;
  to?: string;
}

export async function listJournalEntries(query: JournalEntriesQuery = {}): Promise<JournalEntry[]> {
  const { data } = await apiClient.get<JournalEntry[]>("/journal-entries", { params: query });
  return data;
}

export async function getJournalEntry(id: string): Promise<JournalEntry> {
  const { data } = await apiClient.get<JournalEntry>(`/journal-entries/${id}`);
  return data;
}

export async function createJournalEntry(input: CreateJournalEntryInput): Promise<JournalEntry> {
  const { data } = await apiClient.post<JournalEntry>("/journal-entries", {
    ...input,
    sourceType: "MANUAL",
  });
  return data;
}
