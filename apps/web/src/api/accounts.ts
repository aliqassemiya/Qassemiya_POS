import { apiClient } from "@/lib/apiClient";
import type { Account, AccountLedger, AccountType, NormalBalance } from "@/types/entities";

// No shared-types schema exists for Account yet (packages/shared-types/src/accounting.ts
// is being built in parallel) — this mirrors the Account model fields
// described in the plan, same convention as api/vendors.ts.
export interface AccountInput {
  code: string;
  name: string;
  nameAr?: string;
  type: AccountType;
  normalBalance: NormalBalance;
  parentId?: string;
  isActive?: boolean;
}

export interface AccountsQuery {
  type?: AccountType;
  isActive?: boolean;
  search?: string;
}

export interface AccountLedgerQuery {
  branchId?: string;
  from?: string;
  to?: string;
}

export async function listAccounts(query: AccountsQuery = {}): Promise<Account[]> {
  const { data } = await apiClient.get<Account[]>("/accounts", { params: query });
  return data;
}

export async function getAccount(id: string): Promise<Account> {
  const { data } = await apiClient.get<Account>(`/accounts/${id}`);
  return data;
}

export async function createAccount(input: AccountInput): Promise<Account> {
  const { data } = await apiClient.post<Account>("/accounts", input);
  return data;
}

// isSystem accounts reject changes to code/type/isSystem server-side (the
// update DTO simply omits those fields, per the plan) — the form only ever
// sends name/nameAr/normalBalance/parentId/isActive for those rows.
export async function updateAccount(id: string, input: Partial<AccountInput>): Promise<Account> {
  const { data } = await apiClient.patch<Account>(`/accounts/${id}`, input);
  return data;
}

export async function getAccountLedger(id: string, query: AccountLedgerQuery = {}): Promise<AccountLedger> {
  const { data } = await apiClient.get<AccountLedger>(`/accounts/${id}/ledger`, { params: query });
  return data;
}
