import { apiClient } from "@/lib/apiClient";
import type { DashboardUser, Role } from "@/types/entities";

export interface CreateUserInput {
  email: string;
  password: string;
  fullName: string;
}

export interface UpdateUserInput {
  fullName?: string;
  isActive?: boolean;
  password?: string;
}

export interface AssignRoleInput {
  roleId: string;
  branchId?: string | null;
}

export async function listUsers(): Promise<DashboardUser[]> {
  const { data } = await apiClient.get<DashboardUser[]>("/users");
  return data;
}

export async function getUser(id: string): Promise<DashboardUser> {
  const { data } = await apiClient.get<DashboardUser>(`/users/${id}`);
  return data;
}

export async function listRoles(): Promise<Role[]> {
  const { data } = await apiClient.get<Role[]>("/users/roles");
  return data;
}

export async function createUser(input: CreateUserInput): Promise<DashboardUser> {
  const { data } = await apiClient.post<DashboardUser>("/users", input);
  return data;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<DashboardUser> {
  const { data } = await apiClient.patch<DashboardUser>(`/users/${id}`, input);
  return data;
}

export async function assignRole(userId: string, input: AssignRoleInput): Promise<DashboardUser> {
  const { data } = await apiClient.post<DashboardUser>(`/users/${userId}/roles`, input);
  return data;
}

export async function removeRole(userId: string, userRoleId: string): Promise<DashboardUser> {
  const { data } = await apiClient.delete<DashboardUser>(`/users/${userId}/roles/${userRoleId}`);
  return data;
}
