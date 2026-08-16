import type { RoleName } from "@qassemiya/shared-types";
import { apiClient } from "@/lib/apiClient";
import type { Employee } from "@/types/entities";

export interface EmployeeInput {
  employeeCode: string;
  fullName: string;
  branchId: string;
  roles: RoleName[];
  pinCode?: string;
  isActive?: boolean;
}

export async function listEmployees(branchId?: string): Promise<Employee[]> {
  const { data } = await apiClient.get<Employee[]>("/employees", { params: { branchId } });
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
