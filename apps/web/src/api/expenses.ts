import { apiClient } from "@/lib/apiClient";
import type { Expense } from "@/types/entities";

// No shared-types schema exists for Expense yet — see the note atop
// types/entities.ts.
export interface ExpenseInput {
  branchId?: string;
  categoryAccountId: string;
  amount: number;
  paidByMethodId: string;
  expenseDate: string;
  description?: string;
}

export interface ExpensesQuery {
  branchId?: string;
  from?: string;
  to?: string;
}

export async function listExpenses(query: ExpensesQuery = {}): Promise<Expense[]> {
  const { data } = await apiClient.get<Expense[]>("/expenses", { params: query });
  return data;
}

export async function getExpense(id: string): Promise<Expense> {
  const { data } = await apiClient.get<Expense>(`/expenses/${id}`);
  return data;
}

export async function createExpense(input: ExpenseInput): Promise<Expense> {
  const { data } = await apiClient.post<Expense>("/expenses", input);
  return data;
}
