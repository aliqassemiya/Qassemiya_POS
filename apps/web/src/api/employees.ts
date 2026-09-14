import type { RoleName } from "@qassemiya/shared-types";
import { apiClient } from "@/lib/apiClient";
import type { Employee } from "@/types/entities";
import type { PaginatedResult } from "./pagination";

export interface EmployeeInput {
  employeeCode: string;
  fullName: string;
  email?: string;
  branchId: string;
  // Omit both to create a sales-attribution-only employee with no system
  // access (no login) — see EmployeeForm's "Grant POS access" toggle.
  roles?: RoleName[];
  pinCode?: string;
  isActive?: boolean;
}

export interface EmployeesQuery {
  branchId?: string;
  page?: number;
  pageSize?: number;
}

export async function listEmployees(query: EmployeesQuery = {}): Promise<PaginatedResult<Employee>> {
  const { data } = await apiClient.get<PaginatedResult<Employee>>("/employees", { params: query });
  return data;
}

export async function createEmployee(input: EmployeeInput): Promise<Employee> {
  const { data } = await apiClient.post<Employee>("/employees", input);
  return data;
}

export async function updateEmployee(id: string, input: Partial<EmployeeInput>): Promise<Employee> {
  const { data } = await apiClient.patch<Employee>(`/employees/${id}`, input);
  return data;
}

/** Assumption: no explicit route was documented for PIN reset — REST-conventional guess. */
export async function resetEmployeePin(id: string, pinCode: string): Promise<void> {
  await apiClient.post(`/employees/${id}/reset-pin`, { pinCode });
}
